/**
 * Scrum Master orchestration — dependency-injected for tests / local debug.
 *
 * **Boundary:** Pipeline JSON uses shared loading (`load-sm-config` → `agent-config-file` / `pipeline-config`,
 * same `params.steps` shape as other agents). **All Jira-specific behavior stays here** (and the CLI): JQL
 * interpolation, status filters, search, transitions, labels, skip-by-label — not in generic pipeline helpers.
 */
import type { JiraSearchResponse } from '../../lib/jira/jira-types.js';
import {
  publishJobSummary,
  type JobSummarySegment,
} from '../../lib/github/index.js';
import {
  isPipelineStepEnabled,
  runPipelineStepSequence,
} from '../../lib/pipeline-expected-step-helper.js';
import {
  getPostReadTargetStatusWithOverride,
  getRequiredIssueStatusWithOverride,
  jqlRequireStatusWithOverride,
} from '../../lib/jira-status.js';
import {
  dispatchEntryWorkflowForMappedIssue,
  resolveEntryWorkflowDispatchTarget,
  type EntryWorkflowDispatchConfig,
  type GithubWorkflowDispatchPayload,
} from '../../lib/routing_helper.js';
import { interpolateJql, loadSmConfig } from './load-sm-config.js';
import type { SmDispatchStep } from './sm-types.js';

export interface ScrumMasterContext {
  owner: string;
  repo: string;
  globalLimit: number;
  /** Path to Scrum Master pipeline JSON (`params.steps`; env `PIPELINE_CONFIG_FILE` or legacy `RULES_FILE`). */
  pipelineConfigPath: string;
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
  /** Pipeline step label (`description` or `Step #n`). */
  stepLabel: string;
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

function statusIcon(status: DispatchRecord['status']): string {
  return status === 'dispatched' ? '✅' : status === 'skipped' ? '⏭️' : '❌';
}

function buildScrumMasterSummarySegments(records: DispatchRecord[]): JobSummarySegment[] {
  const dispatched = records.filter((r) => r.status === 'dispatched');
  const skipped = records.filter((r) => r.status === 'skipped');
  const failed = records.filter((r) => r.status === 'failed');
  const stats = `**Total:** ${records.length} · ✅ Dispatched: ${dispatched.length} · ⏭️ Skipped: ${skipped.length} · ❌ Failed: ${failed.length}`;

  const intro: JobSummarySegment[] = [
    '## Scrum Master Summary',
    '',
    stats,
    '',
  ];

  if (records.length === 0) {
    return [...intro, '_No tickets processed._'];
  }

  const rows = records.map((r) => {
    const icon = statusIcon(r.status);
    const detail = r.reason ? `${r.stepLabel} — ${r.reason}` : r.stepLabel;
    const issueLink =
      r.status === 'dispatched' && r.repo
        ? `[🔗 view](https://github.com/${r.repo}/issues?q=is%3Aissue+${r.key})`
        : '—';
    return [r.key, `${icon} ${r.status}`, r.workflow, detail, issueLink];
  });

  return [
    ...intro,
    {
      kind: 'table',
      headers: ['Ticket', 'Status', 'Workflow', 'Step / Reason', 'Issue'],
      rows,
    },
  ];
}

/** One pipeline step (`sm_dispatch_rule`): Jira search + optional dispatch per issue (Jira logic stays here). */
async function runSmDispatchStep(
  ctx: ScrumMasterContext,
  deps: ScrumMasterDeps,
  step: SmDispatchStep,
  stepIndex: number,
  records: DispatchRecord[],
): Promise<number> {
  const requiredOverride = step.requiredJiraStatus?.trim();
  const postOverride = step.postReadStatus?.trim();

  let dispatched = 0;
  const stepLabel = step.description || `Step #${stepIndex + 1}`;
  const wfPath = step.workflowFile?.trim();
  if (!wfPath) {
    throw new Error(`${stepLabel}: workflowFile is required`);
  }
  const entryDispatch: EntryWorkflowDispatchConfig = {
    configFile: step.configFile,
    workflowFile: wfPath,
  };
  const { workflowId: workflowFile, ref: dispatchRef } = resolveEntryWorkflowDispatchTarget(entryDispatch);
  const limit = Math.min(50, step.limit ?? ctx.globalLimit);

  const baseJql = interpolateJql(step.jql);
  const effectiveJql = jqlRequireStatusWithOverride(baseJql, requiredOverride);
  const requiredStatus = getRequiredIssueStatusWithOverride(requiredOverride);

  console.log(`\n══ ${stepLabel} ══`);
  console.log(`   workflow: ${workflowFile} @ ${dispatchRef}`);
  console.log(`   config: ${step.configFile}`);
  console.log(`   status filter: "${requiredStatus}" → ${effectiveJql}`);

  const needLabels = Boolean(step.skipIfLabel);
  const searchFields = needLabels ? (['key', 'labels'] as const) : (['key'] as const);

  const data = await deps.searchIssues(effectiveJql, limit, [...searchFields]);
  let issues = data.issues || [];
  console.log(
    `   matched ${data.total ?? issues.length} issue(s); processing up to ${limit}, got ${issues.length}.`,
  );

  if (step.skipIfLabel) {
    const before = issues.length;
    const skipped = issues.filter((t) => hasLabel(t, step.skipIfLabel!));
    issues = issues.filter((t) => !hasLabel(t, step.skipIfLabel!));
    for (const t of skipped) {
      records.push({
        key: t.key,
        stepLabel,
        workflow: workflowFile,
        status: 'skipped',
        reason: `label "${step.skipIfLabel}"`,
        repo: `${ctx.owner}/${ctx.repo}`,
      });
    }
    if (before !== issues.length) {
      console.log(`   skipIfLabel "${step.skipIfLabel}": ${before - issues.length} skipped`);
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
      await dispatchEntryWorkflowForMappedIssue(deps, ctx, entryDispatch, key);
      console.log(`   ok: ${key}`);
      dispatched++;
      records.push({ key, stepLabel, workflow: workflowFile, status: 'dispatched', repo: `${ctx.owner}/${ctx.repo}` });
      try {
        await deps.transitionIssueToPostRead(key);
        console.log(`   Jira status → ${getPostReadTargetStatusWithOverride(postOverride)}: ${key}`);
      } catch (e) {
        console.warn(`   ⚠️ Jira status update failed for ${key}:`, e);
      }
      if (step.addLabel) {
        try {
          await deps.addIssueLabel(key, step.addLabel);
          console.log(`   label +${step.addLabel}`);
        } catch (e) {
          console.warn(`   ⚠️ addLabel failed for ${key}:`, e);
        }
      }
    } catch (e) {
      console.warn(`   ⚠️ dispatch failed for ${key}:`, e);
      records.push({
        key,
        stepLabel,
        workflow: workflowFile,
        status: 'failed',
        reason: String(e instanceof Error ? e.message : e),
        repo: `${ctx.owner}/${ctx.repo}`,
      });
    }
  }
  return dispatched;
}

/**
 * Loads `scrum-master.config` (pipeline with `sm_dispatch_rule` steps) and dispatches the entry workflow per matched Jira issue.
 * JQL is defined only inside that file — not via env `JQL` or workflow inputs.
 */
export async function runScrumMaster(ctx: ScrumMasterContext, deps: ScrumMasterDeps): Promise<void> {
  const records: DispatchRecord[] = [];

  const cfg = await loadSmConfig(ctx.pipelineConfigPath);
  console.log(`Config file: ${ctx.pipelineConfigPath} (${cfg.steps.length} step(s))`);
  console.log(`Global limit: ${ctx.globalLimit} · Jira statuses: per-step fields or env defaults`);

  await runPipelineStepSequence(cfg.steps, {
    skipStep: (step, i) => {
      if (!isPipelineStepEnabled(step)) {
        console.log(`\n══ Step #${i + 1} (disabled) ══`);
        return true;
      }
      if (!step.jql?.trim() || !step.configFile?.trim() || !step.workflowFile?.trim()) {
        console.warn(`Skipping step #${i + 1}: jql, configFile, and workflowFile are required`);
        return true;
      }
      return false;
    },
    executeStep: (step, i) => runSmDispatchStep(ctx, deps, step, i, records),
    breakAfter: (step, i, dispatched) => {
      if (!step.stopIfDispatched || dispatched <= 0) return false;
      console.log(`\n⏹ stopIfDispatched: step #${i + 1} dispatched ${dispatched} — stopping further steps.`);
      return true;
    },
  });

  await publishJobSummary(buildScrumMasterSummarySegments(records));
}
