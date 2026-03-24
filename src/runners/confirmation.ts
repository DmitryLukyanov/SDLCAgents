/**
 * confirmation runner.
 *
 * Prints a confirmation message at the end of a pipeline.
 * Always returns { status: 'continue' } — it never stops the pipeline.
 *
 * Config:
 *   message  — optional custom message; defaults to a standard "work dispatched" line.
 */
import type { RunnerContext, StepOutcome } from './runner-types.js';

export interface ConfirmationStep {
  runner: 'confirmation';
  /** Optional override for the printed message. */
  message?: string;
}

export async function runConfirmation(
  ctx: RunnerContext,
  config: ConfirmationStep,
): Promise<StepOutcome> {
  const msg =
    config.message ??
    `✅ Pipeline complete for ${ctx.issueKey} — work has been dispatched to the Copilot Coding Agent.`;
  console.log(`  ${msg}`);
  return { status: 'continue' };
}
