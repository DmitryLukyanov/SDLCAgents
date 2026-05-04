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
 * `ba_codex_async` is handled in `runPipelineCi` (`AI_TEAMMATE_MODE=pipeline_ci`): prepares prompt + state,
 * then the reusable workflow uploads artifacts and dispatches the `async_call` child (Codex is not inline here).
 * Shared label gate: `params.skipIfLabel` / `params.addLabel`.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeCallerConfig } from '../../lib/caller-config.js';
import { normalizePipelineStepIds, type PipelineStepConfig } from '../../lib/pipeline-config.js';
import { getPipelineStartIndexFromCallerRoot, isStepEnabled } from '../../lib/pipeline-expected-step-helper.js';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import { runPrintJiraContextToStdout } from './steps/print-jira-context-to-stdout.js';
import { runEnsureJiraFieldsExpected } from './steps/ensure-jira-fields-expected.js';
import { runCreateGithubIssue } from './steps/create-github-issue.js';
import { runStartDeveloperAgent } from './steps/start-developer-agent.js';
import { assertConcurrencyKeyMatchesIssue } from './ai-teammate-codex-ba-shared.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
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
          `Supported: ensure_jira_fields_expected, print_jira_context_to_stdout, create_github_issue, start_developer_agent (ba_codex_async is orchestrated by runPipelineCi).`,
      );
  }
}

export interface StepRecord {
  runner: string;
  status: 'continue' | 'stop';
  reason?: string;
  durationMs: number;
  /** Set on resume: rows from `ba-codex-state.json` were executed in the prepare run, not repeated in this job. */
  source?: 'prepare_checkpoint' | 'this_invocation';
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

  const showInvocation = records.some(r => r.source === 'prepare_checkpoint');
  const invocationLabel = (r: StepRecord) =>
    r.source === 'prepare_checkpoint' ? 'Prior run' : r.source === 'this_invocation' ? 'This run' : 'This run';

  const rows = records
    .map(r => {
      const outcome = `${icon(r)} ${r.status}${r.reason ? ` — ${r.reason}` : ''}`;
      if (showInvocation) {
        return `| \`${r.runner}\` | ${invocationLabel(r)} | ${outcome} | ${ms(r.durationMs)} |`;
      }
      return `| \`${r.runner}\` | ${outcome} | ${ms(r.durationMs)} |`;
    })
    .join('\n');

  const ghRepo = process.env.GITHUB_REPOSITORY ?? repo;
  const issueLink = ctx.githubIssueNumber
    ? `[#${ctx.githubIssueNumber}](https://github.com/${ghRepo}/issues/${ctx.githubIssueNumber})`
    : '—';

  const baStatus = ctx.baOutcome?.status === 'complete' ? '✅ complete'
    : ctx.baOutcome?.status === 'incomplete' ? '⚠️ incomplete'
    : '—';

  const finalStep = records.at(-1);
  const pipelineStatus = finalStep?.status === 'stop' ? '🛑 Halted' : '✅ Completed';

  const resumeNote = showInvocation
    ? '> **Resume after async BA:** Rows marked **Prior run** are replayed from the prepare-phase checkpoint (`ba-codex-state.json`); those steps were **not** executed again in this job. Rows marked **This run** reflect work in the current invocation.\n\n'
    : '';

  const summary = fillTemplate(AI_TEAMMATE_JOB_SUMMARY_TEMPLATE, {
    ISSUE_KEY:        issueKey,
    RESUME_NOTE:      resumeNote,
    PIPELINE_STATUS:  pipelineStatus,
    ISSUE_LINK:       issueLink,
    BA_STATUS:        baStatus,
    TABLE_HEADER_MID: showInvocation ? ' Invocation |' : '',
    TABLE_SEP_MID:    showInvocation ? '------------|' : '',
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
      source: 'this_invocation',
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

function setGithubActionsOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${name}=${value}\n`, 'utf8');
  console.log(`[runPipelineCi] ${name}=${value}`);
}

function requireEnvNonEmpty(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function runFreshPipelineFromConfigForCi(deps: AiTeammateDeps): Promise<void> {
  setGithubActionsOutput('needs_async_handoff', 'false');

  const callerEncoded = requireEnvNonEmpty('CALLER_CONFIG');
  const root = decodeCallerConfig(callerEncoded);
  const { issueKey, steps, ctxInit, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);

  if (runner !== 'pipeline') {
    throw new Error('pipeline_ci requires params.runner "pipeline" in the agent JSON');
  }

  const stepsNorm = normalizePipelineStepIds(steps as PipelineStepConfig[]);
  const startIdx = getPipelineStartIndexFromCallerRoot(stepsNorm, root);
  const skipBa = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';

  const ctx: RunnerContext = { issueKey, ...ctxInit };
  const records: StepRecord[] = [];

  for (let i = startIdx; i < stepsNorm.length; i++) {
    const step = stepsNorm[i]! as PipelineStep;
    console.log(`\n── Step ${i + 1}/${stepsNorm.length}: ${step.runner} ──`);

    if (step.runner === 'ba_codex_async') {
      const t0 = Date.now();
      if (!isStepEnabled(step)) {
        console.log('   ⏭ Skipped — step.enabled is false in config');
        records.push({
          runner: step.runner,
          status: 'continue',
          reason: 'skipped (enabled: false)',
          durationMs: Date.now() - t0,
        });
        continue;
      }
      if (skipBa) {
        console.log(`   ⏭ Skipped — BA segment gated (${skipBa})`);
        records.push({
          runner: step.runner,
          status: 'continue',
          reason: `skipped (${skipBa})`,
          durationMs: Date.now() - t0,
        });
        continue;
      }
      const wf = step.async_call?.workflowFile?.trim();
      if (!wf) {
        throw new Error(
          'ba_codex_async is enabled but has no async_call.workflowFile. ' +
            'Inline Codex was removed from AI Teammate — add async_call (e.g. business-analyst.yml) or set enabled: false.',
        );
      }
      const { runCodexBaPreparePromptPhase, writeBaGithubIssuePrepCheckpoint } = await import(
        './ai-teammate-codex-ba-prepare.js',
      );
      writeBaGithubIssuePrepCheckpoint(issueKey, ctx, records);
      await runCodexBaPreparePromptPhase(deps);
      records.push({ runner: step.runner, status: 'continue', durationMs: Date.now() - t0 });
      setGithubActionsOutput('needs_async_handoff', 'true');
      await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
      return;
    }

    if (step.runner === 'start_developer_agent' && skipBa) {
      const t0 = Date.now();
      console.log('   ⏭ Skipped start_developer_agent — BA segment skipped (skipIfLabel)');
      records.push({
        runner: step.runner,
        status: 'continue',
        reason: 'skipped (BA gated)',
        durationMs: Date.now() - t0,
      });
      continue;
    }

    const stepEnabled = isStepEnabled(step);
    const t0 = Date.now();
    let outcome: StepOutcome;
    if (!stepEnabled) {
      console.log('   ⏭ Skipped — step.enabled is false in config');
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
      console.log(`\n🛑 Pipeline halted at ${step.runner}: ${outcome.reason}`);
      await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
      throw new Error(`Pipeline stopped at ${step.runner}: ${outcome.reason}`);
    }
  }

  console.log(`\nPipeline finished for ${issueKey}.`);
  await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
}

/**
 * `_reusable-ai-teammate.yml` entry: `AI_TEAMMATE_MODE=pipeline_ci`.
 * Resume uses a dynamic import of finish to avoid a circular module graph with this file.
 */
export async function runPipelineCi(deps: AiTeammateDeps): Promise<void> {
  const isResume = process.env.AI_TEAMMATE_IS_RESUME === 'true';
  if (isResume) {
    setGithubActionsOutput('needs_async_handoff', 'false');
    const { runCodexBaFinish } = await import('./ai-teammate-codex-ba-finish.js');
    await runCodexBaFinish(deps);
    return;
  }
  await runFreshPipelineFromConfigForCi(deps);
}
