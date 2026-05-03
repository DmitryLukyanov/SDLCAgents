/**
 * Pipeline runner.
 *
 * Executes an ordered list of steps. Each step names a runner and carries its
 * own config. Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   ensure_jira_fields_expected  — validates Jira description; stops if empty
 *   print_jira_context_to_stdout — logs Jira ticket details + prepares spec-kit workspace
 *   create_github_issue          — creates a GitHub issue placeholder; stores issue number in context
 *   start_developer_agent        — updates issue body with BA results + dispatches developer agent workflow (omit or set `"enabled": false` to skip dispatch only)
 *
 * Codex BA runs in CI or via an `async_call` child workflow between `create_github_issue` and
 * `start_developer_agent`. Shared label gate: `params.skipIfLabel` / `params.addLabel`.
 */
import { join } from 'node:path';
import { isStepEnabled } from '../../lib/pipeline-expected-step-helper.js';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import { runPrintJiraContextToStdout } from './steps/print-jira-context-to-stdout.js';
import { runEnsureJiraFieldsExpected } from './steps/ensure-jira-fields-expected.js';
import { runCreateGithubIssue } from './steps/create-github-issue.js';
import { runStartDeveloperAgent } from './steps/start-developer-agent.js';
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from './runner-types.js';

const AI_TEAMMATE_JOB_SUMMARY_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'job-summary-pipeline.md');

/** spec-kit config as it appears on a print_jira_context_to_stdout pipeline step. */
interface SpecKitStepConfig {
  enabled?: boolean;
  outputDir?: string;
}

export async function runPipelineStep(ctx: RunnerContext, step: PipelineStep, deps: AiTeammateDeps): Promise<StepOutcome> {
  switch (step.runner) {
    case 'ensure_jira_fields_expected': {
      return runEnsureJiraFieldsExpected(ctx, step as unknown as Parameters<typeof runEnsureJiraFieldsExpected>[1], deps);
    }

    case 'print_jira_context_to_stdout': {
      const sk = step.specKit as SpecKitStepConfig | undefined;
      if (sk?.enabled !== false) {
        await deps.prepareSpecKitWorkspace({
          issueKey: ctx.issueKey,
          ...(sk?.outputDir ? { outputDir: sk.outputDir } : {}),
        });
        ctx.specKitContextFile = join(process.cwd(), 'spec-output', ctx.issueKey, 'issueContext.md');
      }
      await runPrintJiraContextToStdout(deps);
      return { status: 'continue' };
    }

    case 'create_github_issue': {
      return runCreateGithubIssue(ctx, deps);
    }

    case 'start_developer_agent': {
      return runStartDeveloperAgent(ctx, step as Parameters<typeof runStartDeveloperAgent>[1], deps);
    }

    default:
      throw new Error(
        `Unknown pipeline step runner: "${step.runner}". ` +
          `Supported: ensure_jira_fields_expected, print_jira_context_to_stdout, create_github_issue, start_developer_agent.`,
      );
  }
}

export interface StepRecord {
  runner: string;
  status: 'continue' | 'stop';
  reason?: string;
  durationMs: number;
}

export async function writeAiTeammatePipelineSummary(
  issueKey: string,
  repo: string,
  records: StepRecord[],
  ctx: RunnerContext,
): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const { appendFile } = await import('node:fs/promises');

  const icon = (s: StepRecord) => s.status === 'continue' ? '✅' : '🛑';
  const ms = (n: number) => n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`;

  const rows = records.map(r =>
    `| \`${r.runner}\` | ${icon(r)} ${r.status}${r.reason ? ` — ${r.reason}` : ''} | ${ms(r.durationMs)} |`
  ).join('\n');

  const ghRepo = process.env.GITHUB_REPOSITORY ?? repo;
  const issueLink = ctx.githubIssueNumber
    ? `[#${ctx.githubIssueNumber}](https://github.com/${ghRepo}/issues/${ctx.githubIssueNumber})`
    : '—';

  const baStatus = ctx.baOutcome?.status === 'complete' ? '✅ complete'
    : ctx.baOutcome?.status === 'incomplete' ? '⚠️ incomplete'
    : '—';

  const finalStep = records.at(-1);
  const pipelineStatus = finalStep?.status === 'stop' ? '🛑 Halted' : '✅ Completed';

  const summary = fillTemplate(AI_TEAMMATE_JOB_SUMMARY_TEMPLATE, {
    ISSUE_KEY:        issueKey,
    PIPELINE_STATUS:  pipelineStatus,
    ISSUE_LINK:       issueLink,
    BA_STATUS:        baStatus,
    STEP_ROWS:        rows,
  });

  await appendFile(summaryPath, summary + '\n');
}

/**
 * Run pipeline steps from the beginning through `lastInclusiveRunner` (inclusive).
 */
export async function runPipelineThroughInclusive(
  issueKey: string,
  steps: PipelineStep[],
  deps: AiTeammateDeps,
  ctxInit: Omit<RunnerContext, 'issueKey' | 'githubIssueNumber' | 'specKitContextFile' | 'baOutcome'>,
  lastInclusiveRunner: string,
): Promise<{ ctx: RunnerContext; records: StepRecord[] }> {
  const ctx: RunnerContext = { issueKey, ...ctxInit };
  const records: StepRecord[] = [];
  let found = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} (partial → "${lastInclusiveRunner}") ──`);

    const stepEnabled = isStepEnabled(step);
    const t0 = Date.now();
    let outcome: StepOutcome;
    if (!stepEnabled) {
      console.log(`   ⏭ Skipped — step.enabled is false in config`);
      outcome = { status: 'continue' };
    } else {
      outcome = await runPipelineStep(ctx, step, deps);
    }
    const durationMs = Date.now() - t0;

    records.push({
      runner: step.runner,
      status: outcome.status,
      reason:
        outcome.status === 'stop' ? outcome.reason : !stepEnabled ? 'skipped (enabled: false)' : undefined,
      durationMs,
    });

    if (outcome.status === 'stop') {
      console.log(`\n🛑 Partial pipeline halted at ${step.runner}: ${outcome.reason}`);
      await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
      throw new Error(`Partial pipeline stopped at ${step.runner}: ${outcome.reason}`);
    }

    if (step.runner === lastInclusiveRunner) {
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error(
      `Pipeline step "${lastInclusiveRunner}" not found — cannot prepare Codex BA.`,
    );
  }

  return { ctx, records };
}

/**
 * Run steps from `startRunner` through the end of the list.
 */
export async function runPipelineFromRunner(
  issueKey: string,
  steps: PipelineStep[],
  startRunner: string,
  deps: AiTeammateDeps,
  ctx: RunnerContext,
  priorRecords: StepRecord[],
): Promise<void> {
  const startIdx = steps.findIndex(s => s.runner === startRunner);
  if (startIdx < 0) {
    throw new Error(`Pipeline step "${startRunner}" not found — cannot resume after Codex BA.`);
  }

  const records = [...priorRecords];

  for (let i = startIdx; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} ──`);

    const stepEnabled = isStepEnabled(step);
    const t0 = Date.now();
    let outcome: StepOutcome;
    if (!stepEnabled) {
      console.log(`   ⏭ Skipped — step.enabled is false in config`);
      outcome = { status: 'continue' };
    } else {
      outcome = await runPipelineStep(ctx, step, deps);
    }
    const durationMs = Date.now() - t0;

    records.push({
      runner: step.runner,
      status: outcome.status,
      reason:
        outcome.status === 'stop' ? outcome.reason : !stepEnabled ? 'skipped (enabled: false)' : undefined,
      durationMs,
    });

    if (outcome.status === 'stop') {
      console.log(`\n🛑 Pipeline halted at step ${i + 1} (${step.runner}): ${outcome.reason}`);
      await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
      return;
    }
  }

  console.log(`\nPipeline finished tail step(s) for ${issueKey}.`);
  await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
}
