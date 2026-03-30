/**
 * Scrum Master orchestration — dependency-injected for tests / local debug.
 */
import { writeFile } from 'node:fs/promises';
import type { JiraSearchResponse } from '../../lib/jira/jira-types.js';
import {
  getPostReadTargetStatus,
  getRequiredIssueStatus,
  jqlRequireStatus,
} from '../../lib/jira-status.js';
import { buildEncodedConfig } from './build-encoded-config.js';
import { interpolateJql, loadSmConfig } from './load-sm-config.js';
import type { SmRule } from './sm-types.js';

export interface ScrumMasterContext {
  owner: string;
  repo: string;
  ref: string;
  globalLimit: number;
  smRulesFile: string;
  /** If set, rules file is skipped (legacy mode). */
  legacyJql: string | undefined;
  legacyConfigFile: string;
  defaultWorkflowFile: string;
}

export interface ScrumMasterDeps {
  searchIssues: (
    jql: string,
    maxResults: number,
    fields: string[],
  ) => Promise<JiraSearchResponse>;
  addIssueLabel: (issueKey: string, label: string) => Promise<void>;
  /** Move ticket to POST_READ_STATUS (e.g. In Progress) after a successful workflow dispatch. */
  transitionIssueToPostRead: (issueKey: string) => Promise<void>;
  dispatchWorkflow: (args: {
    owner: string;
    repo: string;
    workflow_id: string;
    ref: string;
    inputs: Record<string, string>;
  }) => Promise<void>;
}

interface DispatchRecord {
  key: string;
  rule: string;
  workflow: string;
  status: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
  /** GitHub owner/repo for constructing links. */
  repo?: string;
}

function hasLabel(ticket: { fields?: { labels?: string[] } }, label: string): boolean {
  const labels = ticket.fields?.labels ?? [];
  return labels.includes(label);
}

async function printSummaryTable(records: DispatchRecord[]): Promise<void> {
  const dispatched = records.filter((r) => r.status === 'dispatched');
  const skipped = records.filter((r) => r.status === 'skipped');
  const failed = records.filter((r) => r.status === 'failed');

  // ── Console output ──
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                     SCRUM MASTER SUMMARY                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  if (records.length === 0) {
    console.log('║  No tickets processed.                                          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
  } else {
    console.log(`║  Total: ${records.length}  │  ✅ Dispatched: ${dispatched.length}  │  ⏭️ Skipped: ${skipped.length}  │  ❌ Failed: ${failed.length}`);
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║  Ticket     │ Status     │ Workflow              │ Rule / Reason');
    console.log('╟─────────────┼────────────┼───────────────────────┼──────────────');
    for (const r of records) {
      const icon = r.status === 'dispatched' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
      const statusStr = `${icon} ${r.status}`.padEnd(10);
      const detail = r.reason ? `${r.rule} — ${r.reason}` : r.rule;
      console.log(`║  ${r.key.padEnd(11)}│ ${statusStr} │ ${r.workflow.padEnd(21)} │ ${detail}`);
    }
    console.log('╚══════════════════════════════════════════════════════════════════╝');
  }

  // ── Markdown summary for GitHub Actions Job Summary ──
  const lines: string[] = [];
  lines.push('## Scrum Master Summary');
  lines.push('');
  lines.push(`**Total:** ${records.length} · ✅ Dispatched: ${dispatched.length} · ⏭️ Skipped: ${skipped.length} · ❌ Failed: ${failed.length}`);
  lines.push('');

  if (records.length > 0) {
    lines.push('| Ticket | Status | Workflow | Rule / Reason | Issue |');
    lines.push('|--------|--------|----------|---------------|-------|');
    for (const r of records) {
      const icon = r.status === 'dispatched' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
      const detail = r.reason ? `${r.rule} — ${r.reason}` : r.rule;
      const issueLink = r.status === 'dispatched' && r.repo
        ? `[🔗 view](https://github.com/${r.repo}/issues?q=is%3Aissue+${r.key})`
        : '—';
      lines.push(`| ${r.key} | ${icon} ${r.status} | ${r.workflow} | ${detail} | ${issueLink} |`);
    }
  } else {
    lines.push('No tickets processed.');
  }

  lines.push('');
  const md = lines.join('\n');

  // Write to file for workflow to pick up via $GITHUB_STEP_SUMMARY
  const summaryPath = process.env.SM_SUMMARY_FILE || 'sm-summary.md';
  try {
    await writeFile(summaryPath, md, 'utf8');
    console.log(`\nMarkdown summary written to ${summaryPath}`);
  } catch (e) {
    console.warn('Could not write markdown summary file (non-fatal):', e);
  }
}

async function processRule(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
  rule: SmRule,
  ruleIndex: number,
  records: DispatchRecord[],
): Promise<number> {
  if (rule.enabled === false) {
    console.log(`\n══ Rule #${ruleIndex + 1} (disabled) ══`);
    return 0;
  }
  let dispatched = 0;

  const ruleLabel = rule.description || `Rule #${ruleIndex + 1}`;
  const workflowFile = rule.workflowFile || ctx.defaultWorkflowFile;
  const ruleRef = rule.workflowRef || ctx.ref;
  const limit = Math.min(50, rule.limit ?? ctx.globalLimit);

  const baseJql = interpolateJql(rule.jql);
  const effectiveJql = jqlRequireStatus(baseJql);
  const requiredStatus = getRequiredIssueStatus();

  console.log(`\n══ ${ruleLabel} ══`);
  console.log(`   workflow: ${workflowFile} @ ${ruleRef}`);
  console.log(`   config: ${rule.configFile}`);
  console.log(`   status filter: "${requiredStatus}" → ${effectiveJql}`);

  const needLabels = Boolean(rule.skipIfLabel);
  const searchFields = needLabels ? (['key', 'labels'] as const) : (['key'] as const);

  const data = await deps.searchIssues(effectiveJql, limit, [...searchFields]);
  let issues = data.issues || [];
  console.log(
    `   matched ${data.total ?? issues.length} issue(s); processing up to ${limit}, got ${issues.length}.`,
  );

  if (rule.skipIfLabel) {
    const before = issues.length;
    const skipped = issues.filter((t) => hasLabel(t, rule.skipIfLabel!));
    issues = issues.filter((t) => !hasLabel(t, rule.skipIfLabel!));
    for (const t of skipped) {
      records.push({ key: t.key, rule: ruleLabel, workflow: workflowFile, status: 'skipped', reason: `label "${rule.skipIfLabel}"`, repo: `${ctx.owner}/${ctx.repo}` });
    }
    if (before !== issues.length) {
      console.log(`   skipIfLabel "${rule.skipIfLabel}": ${before - issues.length} skipped`);
    }
  }

  if (issues.length === 0) {
    console.log('   Nothing to dispatch.');
    return 0;
  }

  for (const issue of issues) {
    const key = issue.key;
    const encoded = buildEncodedConfig(key);

    console.log(`   Dispatching ${workflowFile} for ${key}...`);
    try {
      await deps.dispatchWorkflow({
        owner: ctx.owner,
        repo: ctx.repo,
        workflow_id: workflowFile,
        ref: ruleRef,
        inputs: {
          concurrency_key: key,
          config_file: rule.configFile,
          encoded_config: encoded,
        },
      });
      console.log(`   ok: ${key}`);
      dispatched++;
      records.push({ key, rule: ruleLabel, workflow: workflowFile, status: 'dispatched', repo: `${ctx.owner}/${ctx.repo}` });
      try {
        await deps.transitionIssueToPostRead(key);
        console.log(`   Jira status → ${getPostReadTargetStatus()}: ${key}`);
      } catch (e) {
        console.warn(`   ⚠️ Jira status update failed for ${key}:`, e);
      }
      if (rule.addLabel) {
        try {
          await deps.addIssueLabel(key, rule.addLabel);
          console.log(`   label +${rule.addLabel}`);
        } catch (e) {
          console.warn(`   ⚠️ addLabel failed for ${key}:`, e);
        }
      }
    } catch (e) {
      console.warn(`   ⚠️ dispatch failed for ${key}:`, e);
      records.push({ key, rule: ruleLabel, workflow: workflowFile, status: 'failed', reason: String(e instanceof Error ? e.message : e), repo: `${ctx.owner}/${ctx.repo}` });
    }
  }
  return dispatched;
}

/** Loads config/workflows/scrum-master/scrum-master.config and runs each rule. If legacyJql is set, treats it as a single synthetic rule. */
export async function runScrumMasterWithRulesOrSingleJql(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
): Promise<void> {
  const records: DispatchRecord[] = [];

  if (ctx.legacyJql) {
    const syntheticRule: SmRule = {
      description: 'legacy JQL',
      jql: ctx.legacyJql,
      configFile: ctx.legacyConfigFile,
      workflowFile: ctx.defaultWorkflowFile,
      workflowRef: ctx.ref,
      limit: ctx.globalLimit,
    };
    await processRule(ctx, deps, syntheticRule, 0, records);
    await printSummaryTable(records);
    return;
  }

  const cfg = await loadSmConfig(ctx.smRulesFile);
  console.log(`SM rules file: ${ctx.smRulesFile} (${cfg.rules.length} rule(s))`);
  console.log(
    `Global limit: ${ctx.globalLimit} · taken status: ${getRequiredIssueStatus()} → ${getPostReadTargetStatus()}`,
  );

  for (let i = 0; i < cfg.rules.length; i++) {
    const rule = cfg.rules[i];
    if (!rule.jql?.trim() || !rule.configFile?.trim()) {
      console.warn(`Skipping rule #${i + 1}: jql and configFile are required`);
      continue;
    }
    const dispatched = await processRule(ctx, deps, rule, i, records);
    if (rule.stopIfDispatched && dispatched > 0) {
      console.log(`\n⏹ stopIfDispatched: rule #${i + 1} dispatched ${dispatched} — stopping further rules.`);
      break;
    }
  }

  printSummaryTable(records);
}
