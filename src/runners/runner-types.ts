/**
 * Shared types for the pipeline runner framework.
 *
 * A pipeline is an ordered list of steps; each step runs a named runner and
 * returns a StepOutcome that tells the pipeline whether to continue or halt.
 */

/** Minimal context passed to every step runner. */
export interface RunnerContext {
  issueKey: string;
}

/**
 * Every runner returns one of two outcomes:
 *   continue — pipeline moves on to the next step
 *   stop     — pipeline halts immediately (no further steps run)
 */
export type StepOutcome =
  | { status: 'continue' }
  | { status: 'stop'; reason: string };

/** A single step inside a pipeline config. */
export interface PipelineStep {
  runner: string;
  [key: string]: unknown;
}

/** Top-level shape of a pipeline agent config. */
export interface PipelineAgentParams {
  runner: 'pipeline';
  steps: PipelineStep[];
}
