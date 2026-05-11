/**
 * stop_pipeline runner.
 *
 * Explicitly halts the pipeline with an optional reason.
 * Can be used as a conditional stopping point in the pipeline configuration.
 */
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

interface StopPipelineStep {
  runner: 'stop_pipeline';
  reason?: string;
}

export async function runStopPipeline(
  ctx: RunnerContext,
  config: StopPipelineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const reason = config.reason?.trim() || 'Pipeline stopped explicitly';
  console.log(`  🛑 Stopping pipeline: ${reason}`);
  return { status: 'stop', reason };
}
