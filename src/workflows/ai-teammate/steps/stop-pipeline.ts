/**
 * stop_pipeline runner.
 *
 * Explicitly halts the pipeline with an optional reason from config.
 * Can be used as a conditional stopping point in the pipeline configuration.
 */
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

interface StopPipelineStep {
  runner: 'stop_pipeline';
  stopReason?: string;
}

export async function runStopPipeline(
  ctx: RunnerContext,
  config: StopPipelineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const reason =
    (typeof config.stopReason === 'string' && config.stopReason.trim())
      ? config.stopReason.trim()
      : 'Pipeline stopped by config (stop_pipeline)';
  console.log(`  🛑 Stopping pipeline: ${reason}`);
  return { status: 'stop', reason };
}
