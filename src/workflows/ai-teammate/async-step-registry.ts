/**
 * Registry of async step runner implementations, keyed by `step.runner` name.
 *
 * The pipeline runner uses `step.async_call` in config (not runner names) to detect async steps.
 * This registry supplies the runner-specific prepare/finish logic for each named runner.
 *
 * To add a new async-capable runner:
 *   1. Implement `AsyncStepRunnerDef` (prepare + finish).
 *   2. Register it here under its runner name.
 *   3. Add `async_call` to the step in the agent config file — no pipeline code changes needed.
 */
import type { AsyncStepRunnerDef } from './runner-types.js';

export const asyncStepRegistry: Record<string, AsyncStepRunnerDef> = {
  ba_codex_async: {
    async prepare(issueKey, ctx, _step, deps, records) {
      const { writeBaGithubIssuePrepCheckpoint, runCodexBaPreparePromptPhase } = await import(
        './ai-teammate-codex-ba-prepare.js'
      );
      writeBaGithubIssuePrepCheckpoint(issueKey, ctx, records);
      await runCodexBaPreparePromptPhase(deps);
    },

    async finish(issueKey, _ctx, _step, deps) {
      const { resumeBaCodexAsyncOutcomeOnly } = await import('./ai-teammate-codex-ba-finish.js');
      const r = await resumeBaCodexAsyncOutcomeOnly(deps);
      return {
        ctx: r.ctx,
        inlineRecord: { runner: 'ba_codex_async', status: r.inlineRecord.status, reason: r.inlineRecord.reason },
        stepOutcome: r.stepOutcome,
      };
    },
  },
};
