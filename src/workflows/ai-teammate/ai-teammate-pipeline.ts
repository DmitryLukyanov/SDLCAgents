/**
 * Pipeline runner.
 *
 * Executes an ordered list of steps. Each step names a runner and carries its
 * own config. Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   ensure_jira_fields_expected  — validates Jira description; stops if empty
 *   create_github_issue          — creates a GitHub issue (Jira snapshot body); stores issue number in context
 *   (developer agent dispatch is now typically done via a terminal async_call step)
 *
 * Jira context snapshot: `create_github_issue` appends a marked block to the issue body.
 *
 * Any step with `async_call` in config is handled generically: on the first run, the pipeline executes the step runner
 * to prepare artifacts, then the reusable workflow uploads artifacts and dispatches the `async_call` child.
 * Parent **resume** after the child: `caller_config.params.async_child_run_id` + `async_trigger_step` — walk steps
 * from the beginning, skip through the trigger step (checkpoint rows), verify child outputs exist
 * (see {@link ../../lib/invocation-handoff.js assertManifestMatchesAsyncStepAndPrimaryOutputPresent}), then run remaining steps.
 * Shared label gate: `params.skipIfLabel` / `params.addLabel`.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  decodeCallerConfig,
  isParentAsyncChildResumeCallerConfig,
  requireAsyncResumeTriggerStepId,
} from '../../lib/caller-config.js';
import { evaluateSkipIfLabelFromConfigFile } from '../../lib/agent-skip-if-label.js';
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
import { prepareCodexBaArtifacts } from './ai-teammate-codex-ba-prepare.js';
import { runApplyBaOutcome } from './steps/apply-ba-outcome.js';
import {
  assertConcurrencyKeyMatchesIssue,
  codexBaPaths,
  loadHandoffPathsFromConfig,
  STATE_VERSION,
  type BaCodexStateFile,
} from './ai-teammate-codex-ba-shared.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome, StepRecord } from './runner-types.js';

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

    // The async boundary is driven by config (`step.async_call.workflowFile`).
    // The step runner itself is only responsible for preparing the invocation artifacts.
    case 'async_operation': {
      await prepareCodexBaArtifacts(ctx, ctx.agentLabelParams ?? {}, deps, ctx.priorStepRecords);
      return { status: 'continue' };
    }

    // Terminal async dispatch: no handoff artifacts, no callback/resume. The pipeline will stop after dispatch.
    case 'async_terminal_operation': {
      return { status: 'continue' };
    }

    case 'apply_ba_outcome': {
      return runApplyBaOutcome(ctx, step, deps);
    }

    default:
      throw new Error(
        `Unknown pipeline step runner: "${step.runner}". ` +
          `Supported: ensure_jira_fields_expected, create_github_issue, async_operation, async_terminal_operation, apply_ba_outcome.`,
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
 * Run steps from `startStepId` through the end of the list.
 *
 * Step ids are stable even when multiple steps share a runner.
 */
export async function runPipelineFromStepId(
  issueKey: string,
  steps: PipelineStep[],
  startStepId: string,
  deps: AiTeammateDeps,
  ctx: RunnerContext,
  priorRecords: StepRecord[],
): Promise<void> {
  const startIdx = findPipelineStepIndexById(normalizePipelineStepIds(steps as unknown as PipelineStepConfig[]), startStepId);
  if (startIdx < 0) {
    const ids = steps.map((s) => s.id).filter(Boolean).join(', ');
    throw new Error(
      `Pipeline step id "${startStepId}" not found — cannot resume. Known ids: ${ids || '(none)'}.`,
    );
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

/** @deprecated Use {@link runPipelineFromStepId} instead (runner names are not stable). */
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
    throw new Error(`Pipeline step "${startRunner}" not found — cannot resume.`);
  }
  const id = steps[startIdx]?.id;
  if (!id) {
    throw new Error(`Pipeline step "${startRunner}" has no id — cannot resume by runner.`);
  }
  return runPipelineFromStepId(issueKey, steps, id, deps, ctx, priorRecords);
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

function writeMultiAsyncResumeCheckpoint(issueKey: string, ctx: RunnerContext, records: StepRecord[]): void {
  const prev = JSON.parse(readFileSync(codexBaPaths(issueKey).state, 'utf8')) as BaCodexStateFile;
  if (prev.version !== STATE_VERSION) {
    throw new Error(
      `Pipeline multi-async checkpoint: unsupported ba-codex-state.json version: ${String(prev.version)}`,
    );
  }

  const p = loadHandoffPathsFromConfig(issueKey);
  const next: BaCodexStateFile = {
    ...prev,
    runnerCtx: {
      issueKey: ctx.issueKey,
      owner: ctx.owner,
      repo: ctx.repo,
      ref: ctx.ref,
      callerConfig: ctx.callerConfig,
      configFile: ctx.configFile,
      githubIssueNumber: ctx.githubIssueNumber,
    },
    codexRelativeOutputPath: p.codexRelativeOutputPath,
    partialRecords: records,
  };

  writeFileSync(p.state, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

async function runPipelineFromConfigForCi(deps: AiTeammateDeps): Promise<void> {
  setGithubActionsOutput('needs_async_handoff', 'false');
  setGithubActionsOutput('async_handoff', '');

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

  let skipBa = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';
  if (!skipBa && !resumeAfterAsyncChild) {
    try {
      const { skipReason, skipIfLabel } = await evaluateSkipIfLabelFromConfigFile({
        configFilePath: requireEnvNonEmpty('CONFIG_FILE'),
        issueKey,
      });
      skipBa = skipReason;
      if (skipReason && skipIfLabel) {
        console.log(`[pipeline] Jira ${issueKey} has label "${skipIfLabel}" — gated segment will be skipped.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[pipeline] skipIfLabel gate check failed — continuing without gate. Details: ${msg}`);
    }
  }

  let ctx: RunnerContext = { issueKey, ...ctxInit, skipBaReason: skipBa || undefined };
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

      // Verify the async child uploaded its output artifacts before we continue.
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

      // Output artifacts are on disk (downloaded by the YAML step before this script ran).
      // The next sync step (apply_ba_outcome) will read them.
      records.push({
        runner: triggerStep.runner,
        status: 'continue',
        durationMs: Date.now() - t0,
        source: 'this_invocation',
      });
      continue;
    }

    if (step.async_call) {
      const t0 = Date.now();
      console.log(`[ai-teammate-pipeline] ======== ASYNC STEP DETECTED ========`);
      console.log(`[ai-teammate-pipeline] Step runner: ${step.runner}`);
      console.log(`[ai-teammate-pipeline] Step id: ${step.id}`);
      console.log(`[ai-teammate-pipeline] Step enabled: ${isStepEnabled(step)}`);
      console.log(`[ai-teammate-pipeline] async_call config:`, JSON.stringify(step.async_call, null, 2));

      if (!isStepEnabled(step)) {
        console.log('   ⏭ Skipped — step.enabled is false in config');
        records.push({
          runner: step.runner,
          status: 'continue',
          reason: 'skipped (enabled: false)',
          durationMs: Date.now() - t0,
          source: 'this_invocation',
        });
        continue;
      }
      if (!step.async_call.workflowFile?.trim()) {
        console.log(`[ai-teammate-pipeline] ERROR: Step has async_call but no workflowFile!`);
        throw new Error(
          `Step "${step.runner}" (id "${step.id}") has async_call but no async_call.workflowFile. ` +
            'Add async_call.workflowFile or set enabled: false.',
        );
      }

      console.log(`[ai-teammate-pipeline] workflowFile: "${step.async_call.workflowFile.trim()}"`);

      if (resumeAfterAsyncChild) {
        console.log(`[ai-teammate-pipeline] Saving multi-async resume checkpoint...`);
        writeMultiAsyncResumeCheckpoint(issueKey, ctx, records);
      }

      // Run the step to prepare input artifacts, then signal handoff.
      ctx.priorStepRecords = records;
      console.log(`[ai-teammate-pipeline] Running pipeline step to prepare artifacts...`);
      const prepOutcome = await runPipelineStep(ctx, step as PipelineStep, deps);
      console.log(`[ai-teammate-pipeline] Step preparation outcome: status=${prepOutcome.status}${prepOutcome.status === 'stop' ? `, reason="${prepOutcome.reason}"` : ''}`);
      records.push({ runner: step.runner, status: prepOutcome.status, durationMs: Date.now() - t0 });
      if (prepOutcome.status === 'stop') {
        console.log(`\n🛑 Pipeline halted at ${step.runner}: ${prepOutcome.reason}`);
        await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
        return;
      }

      // Provide a single structured output so the YAML dispatch step can stay generic.
      // (The dispatch step still reads config to build the full dispatch payload.)
      const triggerStepId = step.id ?? `${step.runner}#${i}`;
      const asyncHandoffData = {
        triggerStep: triggerStepId,
        workflowFile: step.async_call.workflowFile.trim(),
        workflowRef: step.async_call.workflowRef?.trim() || '',
        issueKey: ctx.issueKey,
        githubIssueNumber: ctx.githubIssueNumber,
      };
      console.log(`[ai-teammate-pipeline] Setting async_handoff output:`, JSON.stringify(asyncHandoffData, null, 2));
      setGithubActionsOutput('async_handoff', JSON.stringify(asyncHandoffData));
      setGithubActionsOutput('needs_async_handoff', 'true');
      console.log(`[ai-teammate-pipeline] Set needs_async_handoff=true`);
      await writeAiTeammatePipelineSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);

      if (step.runner === 'async_terminal_operation') {
        console.log(`[ai-teammate-pipeline] Step is async_terminal_operation — pipeline will stop here (no resume).`);
        console.log(`[ai-teammate-pipeline] ======== PIPELINE ENDED (TERMINAL ASYNC) ========`);
        return;
      }
      console.log(`[ai-teammate-pipeline] Step is async_operation (non-terminal) — pipeline will stop and wait for callback.`);
      console.log(`[ai-teammate-pipeline] ======== PIPELINE PAUSED (WAITING FOR ASYNC CHILD) ========`);
      return;
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
