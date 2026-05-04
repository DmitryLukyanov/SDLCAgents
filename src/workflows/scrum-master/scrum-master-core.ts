/**
 * Scrum Master orchestration — dependency-injected for tests / local debug.
 */
import { appendFile } from 'node:fs/promises';
import type { JiraSearchResponse } from '../../lib/jira/jira-types.js';
import {
  getPostReadTargetStatusWithOverride,
  getRequiredIssueStatusWithOverride,
  jqlRequireStatusWithOverride,
} from '../../lib/jira-status.js';
import {
  dispatchEntryWorkflowForMappedIssue,
  resolveEntryWorkflowDispatchTarget,
  type GithubWorkflowDispatchPayload,
} from '../../lib/routing_helper.js';
import { interpolateJql, loadSmConfig } from './load-sm-config.js';
import type { SmRule } from './sm-types.js';

export interface ScrumMasterContext {
  owner: string;
  repo: string;
  ref: string;
  globalLimit: number;
  /** Path to `scrum-master.config` JSON (env `RULES_FILE`). */
  rulesFile: string;
  /** Default workflow filename when a rule omits `workflowFile` (env `WORKFLOW_FILE`). */
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
  dispatchWorkflow: (args: GithubWorkflowDispatchPayload) => Promise<void>;
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

  // GitHub Actions exposes GITHUB_STEP_SUMMARY as a path — append markdown directly (no temp copy step).
  const stepSummary = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (stepSummary) {
    try {
      await appendFile(stepSummary, `${md}\n`, 'utf8');
    } catch (e) {
      console.warn('Could not append to GITHUB_STEP_SUMMARY (non-fatal):', e);
    }
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

  const requiredOverride = rule.requiredJiraStatus?.trim();
  const postOverride = rule.postReadStatus?.trim();

  let dispatched = 0;
  try {
    const ruleLabel = rule.description || `Rule #${ruleIndex + 1}`;
    const { workflowId: workflowFile, ref: ruleRef } = resolveEntryWorkflowDispatchTarget(ctx, rule);
    const limit = Math.min(50, rule.limit ?? ctx.globalLimit);

    const baseJql = interpolateJql(rule.jql);
    const effectiveJql = jqlRequireStatusWithOverride(baseJql, requiredOverride);
    const requiredStatus = getRequiredIssueStatusWithOverride(requiredOverride);

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
      console.log(`   Dispatching ${workflowFile} for ${key}...`);
      try {
        await dispatchEntryWorkflowForMappedIssue(deps, ctx, rule, key);
        console.log(`   ok: ${key}`);
        dispatched++;
        records.push({ key, rule: ruleLabel, workflow: workflowFile, status: 'dispatched', repo: `${ctx.owner}/${ctx.repo}` });
        try {
          await deps.transitionIssueToPostRead(key);
          console.log(`   Jira status → ${getPostReadTargetStatusWithOverride(postOverride)}: ${key}`);
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
  } finally {
    // no per-rule global state to restore
  }
}

/**
 * Loads rules from `scrum-master.config` (JQL per rule) and dispatches AI Teammate per matched issue.
 * JQL is defined only inside that file — not via env `JQL` or workflow inputs.
 */
export async function runScrumMaster(ctx: ScrumMasterContext, deps: ScrumMasterDeps): Promise<void> {
  const records: DispatchRecord[] = [];

  const cfg = await loadSmConfig(ctx.rulesFile);
  console.log(`Rules file: ${ctx.rulesFile} (${cfg.rules.length} rule(s))`);
  console.log(`Global limit: ${ctx.globalLimit} · Jira statuses: per-rule fields or env defaults`);

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

  await printSummaryTable(records);
}
