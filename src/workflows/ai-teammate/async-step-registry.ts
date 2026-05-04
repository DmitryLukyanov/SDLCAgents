import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from './runner-types.js';
import { prepareCodexBaArtifacts } from './ai-teammate-codex-ba-prepare.js';
import { resumeBaCodexAsyncOutcomeOnly } from './ai-teammate-codex-ba-finish.js';

export type AsyncStepPrepareArgs = {
  ctx: RunnerContext;
  step: PipelineStep;
  deps: AiTeammateDeps;
};

export type AsyncStepFinishArgs = {
  ctx: RunnerContext;
  step: PipelineStep;
  deps: AiTeammateDeps;
};

export type AsyncStepRunnerDef = {
  /** Prepare artifacts before dispatching `step.async_call.workflowFile`. */
  prepare: (args: AsyncStepPrepareArgs) => Promise<void>;
  /** Finish step after async child completes (parent resume). */
  finish: (args: AsyncStepFinishArgs) => Promise<StepOutcome>;
};

/**
 * Registry of async step runners.
 *
 * The pipeline is fully config-driven for *which* workflow to dispatch:
 * `async_call.workflowFile` in the step config decides the child workflow.
 * This registry only defines the (shared) contract for how the parent prepares
 * inputs and consumes outputs.
 */
export const asyncStepRegistry: Record<string, AsyncStepRunnerDef> = {
  ba_async: {
    prepare: async ({ ctx, deps }) => {
      await prepareCodexBaArtifacts(ctx, ctx.agentLabelParams ?? {}, deps, ctx.priorStepRecords);
    },
    finish: async ({ ctx, deps }) => {
      const r = await resumeBaCodexAsyncOutcomeOnly(deps);
      ctx.baOutcome = r.ctx.baOutcome;
      return r.stepOutcome;
    },
  },
};
