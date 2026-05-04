/**
 * Codex BA — finish (no LLM here): read Codex output file, apply BA outcome, resume pipeline.
 *
 * Parent resume after async (`pipeline_ci` + `caller_config.params.async_child_run_id`).
 * The BA LLM runs in the consumer async workflow (`business-analyst.yml` → `_reusable-codex-run.yml`).
 */
import { readFileSync, existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { interpretBaModelOutput } from '../business-analyst/analyze-ticket.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
import {
  runPipelineFromRunner,
  writeAiTeammatePipelineSummary,
} from './ai-teammate-pipeline.js';
import type { StepRecord } from './runner-types.js';
import { applyCodexBaOutcomeToJiraAndGithub } from './steps/apply-codex-ba-outcome-to-jira-github.js';
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from './runner-types.js';
import {
  STATE_VERSION,
  assertConcurrencyKeyMatchesIssue,
  codexBaPaths,
  type BaCodexStateFile,
} from './ai-teammate-codex-ba-shared.js';

export interface BaCodexAsyncResumeResult {
  issueKey: string;
  steps: PipelineStep[];
  ctx: RunnerContext;
  priorForSummary: StepRecord[];
  inlineRecord: StepRecord;
  stepOutcome: StepOutcome;
}

/**
 * Read `ba-codex-state.json`, interpret Codex primary output, apply BA to Jira/GitHub.
 * Does not run tail pipeline steps — {@link runPipelineCi} continues the unified step loop after this.
 */
export async function resumeBaCodexAsyncOutcomeOnly(deps: AiTeammateDeps): Promise<BaCodexAsyncResumeResult> {
  const { issueKey, steps, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);
  if (runner !== 'pipeline') {
    throw new Error('resumeBaCodexAsyncOutcomeOnly requires params.runner "pipeline"');
  }

  const p = codexBaPaths(issueKey);

  const skipReasonFromWorkflow = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';
  if (skipReasonFromWorkflow) {
    console.log(`[codex-ba-resume] BA skipped (workflow) — ${skipReasonFromWorkflow}`);
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      await appendFile(
        summaryPath,
        `\n## Codex BA skipped\n\n**${issueKey}** — ${skipReasonFromWorkflow}\n`,
      );
    }
    throw new Error(
      `[codex-ba-resume] Cannot apply BA outcome while AI_TEAMMATE_SKIP_BA_REASON is set (${skipReasonFromWorkflow})`,
    );
  }

  if (!existsSync(p.state)) {
    throw new Error(`[codex-ba-resume] Missing state file: ${p.state}`);
  }

  const rawState = JSON.parse(readFileSync(p.state, 'utf8')) as BaCodexStateFile & {
    baOptions?: { skipIfLabel?: string; addLabel?: string };
    baStep?: { skipIfLabel?: string; addLabel?: string };
  };
  if (rawState.version !== STATE_VERSION) {
    throw new Error(`[codex-ba-resume] Unsupported ba-codex-state.json version: ${rawState.version}`);
  }
  const agentLabelParams =
    rawState.agentLabelParams ??
    rawState.baOptions ??
    (rawState.baStep ? { skipIfLabel: rawState.baStep.skipIfLabel, addLabel: rawState.baStep.addLabel } : undefined);
  if (!agentLabelParams) {
    throw new Error('[codex-ba-resume] ba-codex-state.json must include agentLabelParams (or legacy baOptions / baStep)');
  }
  const state: BaCodexStateFile = {
    version: rawState.version,
    ticketCtx: rawState.ticketCtx,
    agentLabelParams,
    runnerCtx: rawState.runnerCtx,
    codexRelativeOutputPath: rawState.codexRelativeOutputPath,
    partialRecords: rawState.partialRecords,
  };

  const outAbs = join(process.cwd(), state.codexRelativeOutputPath);
  let codexOutput = '';
  try {
    codexOutput = readFileSync(outAbs, 'utf8');
  } catch {
    console.warn(`[codex-ba-resume] Missing or unreadable Codex output: ${outAbs}`);
  }

  const ctx: RunnerContext = {
    ...state.runnerCtx,
    baOutcome: undefined,
  };

  console.log('\n── BA: Interpreting Codex output (async resume) ──');
  const outcome = interpretBaModelOutput(codexOutput, state.ticketCtx);
  ctx.baOutcome = outcome;

  const stepOutcome = await applyCodexBaOutcomeToJiraAndGithub(ctx, agentLabelParams, deps, outcome);

  const priorForSummary: StepRecord[] = (state.partialRecords ?? []).map(r => ({
    ...r,
    source: 'prepare_checkpoint',
  }));

  const inlineRecord: StepRecord = {
    runner: 'ba_async',
    status: stepOutcome.status,
    reason: stepOutcome.status === 'stop' ? stepOutcome.reason : undefined,
    durationMs: 0,
    source: 'this_invocation',
  };

  return { issueKey, steps, ctx, priorForSummary, inlineRecord, stepOutcome };
}

export async function runCodexBaFinish(deps: AiTeammateDeps): Promise<void> {
  const { issueKey, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);
  if (runner !== 'pipeline') {
    throw new Error('Codex BA resume requires params.runner "pipeline"');
  }

  const skipReasonFromWorkflow = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';
  if (skipReasonFromWorkflow) {
    console.log(`[codex-ba-finish] BA skipped (workflow) — ${skipReasonFromWorkflow}`);
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      await appendFile(
        summaryPath,
        `\n## Codex BA skipped\n\n**${issueKey}** — ${skipReasonFromWorkflow}\n`,
      );
    }
    return;
  }

  const r = await resumeBaCodexAsyncOutcomeOnly(deps);

  if (r.stepOutcome.status === 'stop') {
    await writeAiTeammatePipelineSummary(
      r.issueKey,
      `${r.ctx.owner}/${r.ctx.repo}`,
      [...r.priorForSummary, r.inlineRecord],
      r.ctx,
    );
    return;
  }

  await runPipelineFromRunner(
    r.issueKey,
    r.steps,
    'start_developer_agent',
    deps,
    r.ctx,
    [...r.priorForSummary, r.inlineRecord],
  );
}
