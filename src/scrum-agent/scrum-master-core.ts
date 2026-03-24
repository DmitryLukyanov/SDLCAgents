/**
 * Scrum Master orchestration — dependency-injected for tests / local debug.
 */
import type { JiraSearchResponse } from '../jira/jira-types.js';
import {
  getPostReadTargetStatus,
  getRequiredIssueStatus,
  jqlRequireStatus,
} from '../lib/jira-status.js';
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

function hasLabel(ticket: { fields?: { labels?: string[] } }, label: string): boolean {
  const labels = ticket.fields?.labels ?? [];
  return labels.includes(label);
}

async function processRule(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
  rule: SmRule,
  ruleIndex: number,
): Promise<void> {
  if (rule.enabled === false) {
    console.log(`\n══ Rule #${ruleIndex + 1} (disabled) ══`);
    return;
  }

  const label = rule.description || `Rule #${ruleIndex + 1}`;
  const workflowFile = rule.workflowFile || ctx.defaultWorkflowFile;
  const ruleRef = rule.workflowRef || ctx.ref;
  const limit = Math.min(50, rule.limit ?? ctx.globalLimit);

  const baseJql = interpolateJql(rule.jql);
  const effectiveJql = jqlRequireStatus(baseJql);
  const requiredStatus = getRequiredIssueStatus();

  console.log(`\n══ ${label} ══`);
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
    issues = issues.filter((t) => !hasLabel(t, rule.skipIfLabel!));
    if (before !== issues.length) {
      console.log(`   skipIfLabel "${rule.skipIfLabel}": ${before - issues.length} skipped`);
    }
  }

  if (issues.length === 0) {
    console.log('   Nothing to dispatch.');
    return;
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
    }
  }
}

/** One JQL + one agent JSON from env; config/sm.json is not loaded (no per-rule labels). */
async function runScrumMasterWithSingleJqlOnly(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
): Promise<void> {
  const effectiveJql = jqlRequireStatus(ctx.legacyJql!);
  const requiredStatus = getRequiredIssueStatus();
  console.log(`Single-JQL mode (rules file skipped) · "${requiredStatus}": ${effectiveJql}`);

  const data = await deps.searchIssues(effectiveJql, ctx.globalLimit, ['key']);
  const issues = data.issues || [];
  console.log(
    `JQL matched ${data.total ?? issues.length} issue(s); processing up to ${ctx.globalLimit}, got ${issues.length}.`,
  );

  if (issues.length === 0) {
    console.log('Nothing to dispatch.');
    return;
  }

  for (const issue of issues) {
    const key = issue.key;
    const encoded = buildEncodedConfig(key);
    console.log(`Dispatching ${ctx.defaultWorkflowFile} for ${key} (ref=${ctx.ref})...`);
    await deps.dispatchWorkflow({
      owner: ctx.owner,
      repo: ctx.repo,
      workflow_id: ctx.defaultWorkflowFile,
      ref: ctx.ref,
      inputs: {
        concurrency_key: key,
        config_file: ctx.legacyConfigFile,
        encoded_config: encoded,
      },
    });
    console.log(`  ok: ${key}`);
    try {
      await deps.transitionIssueToPostRead(key);
      console.log(`  Jira status → ${getPostReadTargetStatus()}: ${key}`);
    } catch (e) {
      console.warn(`  ⚠️ Jira status update failed for ${key}:`, e);
    }
  }

  console.log(`Done. Dispatched ${issues.length} workflow run(s).`);
}

/** Loads config/sm.json and runs each rule, unless env JQL is set — then only single-JQL + one agent file. */
export async function runScrumMasterWithRulesOrSingleJql(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
): Promise<void> {
  if (ctx.legacyJql) {
    await runScrumMasterWithSingleJqlOnly(ctx, deps);
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
    await processRule(ctx, deps, rule, i);
  }

  console.log('\nSM finished all rules.');
}
