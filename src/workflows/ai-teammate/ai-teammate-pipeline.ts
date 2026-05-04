/**
 * Pipeline runner.
 *
 * Executes an ordered list of steps. Each step names a runner and carries its
 * own config. Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   ensure_jira_fields_expected  — validates Jira description; stops if empty
 *   create_github_issue          — creates a GitHub issue (Jira snapshot body); stores issue number in context
 *   start_developer_agent        — updates issue body with BA results + dispatches developer agent workflow (omit or set `"enabled": false` to skip dispatch only)
 *
 * Jira context snapshot: `create_github_issue` appends a marked block to the issue body; `start_developer_agent` / `assign_copilot`
 * read it back via `fetchJiraContextFromGithubIssue`.
 *
 * Any step with `async_call` in config is handled generically: the pipeline calls `asyncStepRegistry[step.runner].prepare()`
 * on the first run, then the reusable workflow uploads artifacts and dispatches the `async_call` child.
 * Parent **resume** after the child: `caller_config.params.async_child_run_id` + `async_trigger_step` — walk steps
 * from the beginning, skip through the trigger step (checkpoint rows), call `asyncStepRegistry[step.runner].finish()`
 * (see {@link ../../lib/invocation-handoff.js assertManifestMatchesAsyncStepAndPrimaryOutputPresent}), then run remaining steps.
 * New async runners: add an `AsyncStepRunnerDef` to `async-step-registry.ts` — no pipeline code changes needed.
 * Shared label gate: `params.skipIfLabel` / `params.addLabel`.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import {
  decodeCallerConfig,
  isParentAsyncChildResumeCallerConfig,
  requireAsyncResumeTriggerStepId,
} from '../../lib/caller-config.js';
import { assertManifestMatchesAsyncStepAndPrimaryOutputPresent } from '../../lib/invocation-handoff.js';
import { normalizePipelineStepIds, type PipelineStepConfig } from '../../lib/pipeline-config.js';
import {
  findPipelineStepIndexById,
  getPipelineStartIndexFromCallerRoot,
  isStepEnabled,
} from '../../lib/pipeline-expected-step-helper.js';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import { runEnsureJiraFieldsExpected } from './steps/ensure-jira-fields-expected.js';
import { runCreateGithubIssue } from './steps/create-github-issue.js';
import { runStartDeveloperAgent } from './steps/start-developer-agent.js';
import { assertConcurrencyKeyMatchesIssue, codexBaPaths, STATE_VERSION } from './ai-teammate-codex-ba-shared.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
import type { AiTeammateDeps, AsyncStepFinishResult, PipelineStep, RunnerContext, StepOutcome, StepRecord } from './runner-types.js';

// StepRecord is defined in runner-types.ts; re-exported here for backward compat.
export type { StepRecord } from './runner-types.js';

const AI_TEAMMATE_JOB_SUMMARY_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'job-summary-pipeline.md');

export async function runPipelineStep(ctx: RunnerContext, step: PipelineStep, deps: AiTeammateDeps): Promise<StepOutcome> {
  switch (step.runner) {
    case 'ensure_jira_fields_expected': {
      return runEnsureJiraFieldsExpected(ctx, step as unknown as Parameters<typeof runEnsureJiraFieldsExpected>[1], deps);
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
          `Supported: ensure_jira_fields_expected, create_github_issue, start_developer_agent (ba_codex_async is orchestrated in runPipelineCi).`,
      );
  }
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
  ctxInit: Omit<RunnerContext, 'issueKey' | 'githubIssueNumber' | 'baOutcome'>,
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

async function runPipelineFromConfigForCi(deps: AiTeammateDeps): Promise<void> {
  setGithubActionsOutput('needs_async_handoff', 'false');

  const callerEncoded = requireEnvNonEmpty('CALLER_CONFIG');
  const root = decodeCallerConfig(callerEncoded);
  const { issueKey, steps, ctxInit, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);

  if (runner !== 'pipeline') {
    throw new Error('pipeline_ci requires params.runner "pipeline" in the agent JSON');
  }

  const stepsNorm = normalizePipelineStepIds(steps as PipelineStepConfig[]);
  const resumeAfterAsyncChild = isParentAsyncChildResumeCallerConfig(root);
  let loopStart = 0;
  if (!resumeAfterAsyncChild) {
    loopStart = getPipelineStartIndexFromCallerRoot(stepsNorm, root);
  }

  let triggerIdx = -1;
  let checkpointPartial: StepRecord[] = [];
  if (resumeAfterAsyncChild) {
    const triggerId = requireAsyncResumeTriggerStepId(root);
    triggerIdx = findPipelineStepIndexById(stepsNorm, triggerId);
    if (triggerIdx < 0) {
      const ids = stepsNorm.map(s => s.id).join(', ');
      throw new Error(
        `Pipeline async resume: no step with id "${triggerId}". Known ids: ${ids}`,
      );
    }
    const statePath = codexBaPaths(issueKey).state;
    if (!existsSync(statePath)) {
      throw new Error(`Pipeline async resume: missing checkpoint ${statePath}`);
    }
    const raw = JSON.parse(readFileSync(statePath, 'utf8')) as { version?: number; partialRecords?: StepRecord[] };
    if (raw.version !== STATE_VERSION) {
      throw new Error(
        `Pipeline async resume: unsupported ba-codex-state.json version: ${String(raw.version ?? '(missing)')}`,
      );
    }
    checkpointPartial = Array.isArray(raw.partialRecords) ? raw.partialRecords : [];
    if (checkpointPartial.length < triggerIdx) {
      throw new Error(
        `Pipeline async resume: ba-codex-state.json partialRecords length (${checkpointPartial.length}) ` +
          `is less than the index of async_trigger_step "${triggerId}" (${triggerIdx}).`,
      );
    }
  }

  const skipBa = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';

  let ctx: RunnerContext = { issueKey, ...ctxInit };
  const records: StepRecord[] = [];

  for (let i = resumeAfterAsyncChild ? 0 : loopStart; i < stepsNorm.length; i++) {
    const step = stepsNorm[i]! as PipelineStep;
    console.log(`\n── Step ${i + 1}/${stepsNorm.length}: ${step.runner} ──`);

    if (resumeAfterAsyncChild && i < triggerIdx) {
      const t0 = Date.now();
      const fromCk = checkpointPartial[i];
      if (fromCk && fromCk.runner === step.runner) {
        records.push({
          ...fromCk,
          source: 'prepare_checkpoint',
          durationMs: fromCk.durationMs ?? 0,
        });
      } else {
        records.push({
          runner: step.runner,
          status: 'continue',
          reason: fromCk
            ? `skipped (async resume: checkpoint runner mismatch, expected "${step.runner}", got "${fromCk.runner}")`
            : 'skipped (async resume: missing checkpoint row)',
          durationMs: Date.now() - t0,
          source: 'prepare_checkpoint',
        });
      }
      console.log('   ⏭ Skipped — async parent resume (prior invocation)');
      continue;
    }

    if (resumeAfterAsyncChild && i === triggerIdx) {
      const triggerStep = step;
      if (!triggerStep.async_call?.workflowFile?.trim()) {
        throw new Error(
          `Pipeline async resume: step id "${triggerStep.id}" (${triggerStep.runner}) has no async_call.workflowFile.`,
        );
      }

      const { asyncStepRegistry } = await import('./async-step-registry.js');
      const asyncRunner = asyncStepRegistry[triggerStep.runner];
      if (!asyncRunner) {
        throw new Error(
          `Pipeline async resume: no async step runner registered for "${triggerStep.runner}". ` +
            `Register it in async-step-registry.ts.`,
        );
      }

      assertManifestMatchesAsyncStepAndPrimaryOutputPresent({
        cwd: process.cwd(),
        issueKey,
        triggerStep: triggerStep as PipelineStepConfig,
        contextLabel: 'Pipeline async resume',
      });

      const t0 = Date.now();
      if (!isStepEnabled(triggerStep)) {
        console.log('   ⏭ Skipped — step.enabled is false in config');
        records.push({
          runner: triggerStep.runner,
          status: 'continue',
          reason: 'skipped (enabled: false)',
          durationMs: Date.now() - t0,
          source: 'this_invocation',
        });
        await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
        return;
      }
      if (skipBa) {
        console.log(`   ⏭ Skipped — BA segment gated (${skipBa})`);
        records.push({
          runner: triggerStep.runner,
          status: 'continue',
          reason: `skipped (${skipBa})`,
          durationMs: Date.now() - t0,
          source: 'this_invocation',
        });
        await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
        return;
      }

      const finishResult: AsyncStepFinishResult = await asyncRunner.finish(issueKey, ctx, triggerStep as PipelineStep, deps);
      ctx = finishResult.ctx;
      records.push({
        ...finishResult.inlineRecord,
        durationMs: Date.now() - t0,
        source: 'this_invocation',
      });

      if (finishResult.stepOutcome.status === 'stop') {
        console.log(`\n🛑 Pipeline halted at ${triggerStep.runner}: ${finishResult.stepOutcome.reason}`);
        await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
        return;
      }
      continue;
    }

    if (step.async_call) {
      if (resumeAfterAsyncChild) {
        throw new Error(
          'Pipeline async resume: encountered an async step after async_trigger_step; only one async handoff boundary is supported per invocation.',
        );
      }
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
      const wf = step.async_call.workflowFile?.trim();
      if (!wf) {
        throw new Error(
          `Step "${step.runner}" (id "${step.id}") has async_call but no async_call.workflowFile. ` +
            'Add async_call.workflowFile or set enabled: false.',
        );
      }
      const { asyncStepRegistry } = await import('./async-step-registry.js');
      const asyncRunner = asyncStepRegistry[step.runner];
      if (!asyncRunner) {
        throw new Error(
          `No async step runner registered for "${step.runner}". Register it in async-step-registry.ts.`,
        );
      }
      await asyncRunner.prepare(issueKey, ctx, step as PipelineStep, deps, records);
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
 * Parent resume is driven by `caller_config.params.async_child_run_id` + `async_trigger_step` (see `runPipelineFromConfigForCi`).
 */
export async function runPipelineCi(deps: AiTeammateDeps): Promise<void> {
  await runPipelineFromConfigForCi(deps);
}
