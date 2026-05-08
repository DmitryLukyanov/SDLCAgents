/**
 * Helpers for the **expected** first pipeline step index on an invocation when using `async_trigger_step`
 * **without** `async_child_run_id` (mid-entry). Parent resume after an async child is handled in AI Teammate
 * `runPipelineFromConfigForCi` via `caller_config.params.async_child_run_id` + the same step id.
 * Pure functions — no I/O. Pair with `pipeline-config.ts` for normalized step ids.
 */

import type { CallerConfigRoot } from './caller-config.js';
import type { PipelineStepConfig } from './pipeline-config.js';

export interface PipelineResumeCursor {
  /** `caller_config.params.async_trigger_step` — stable step id (inclusive skip boundary). */
  asyncTriggerStepId: string;
}

/**
 * Index of the first step to execute on this invocation (mid-entry cursor only).
 * - No `async_trigger_step` on the caller: 0.
 * - With `async_trigger_step`: first index **after** the step whose `id` matches (that step and all before it are not run).
 */
export function getPipelineStartIndex(
  steps: PipelineStepConfig[],
  resume: PipelineResumeCursor | undefined,
): number {
  if (!resume?.asyncTriggerStepId?.trim()) return 0;
  const target = resume.asyncTriggerStepId.trim();
  const boundaryIdx = steps.findIndex(s => s.id === target);
  if (boundaryIdx < 0) {
    throw new Error(
      `Pipeline resume: no step with id "${target}". Known ids: ${steps.map(s => s.id).join(', ')}`,
    );
  }
  return boundaryIdx + 1;
}

/** Any step-shaped object with optional `enabled` (JSON pipeline steps, Scrum Master dispatch steps, …). */
export function isPipelineStepEnabled(step: { enabled?: boolean }): boolean {
  return step.enabled !== false;
}

export function isStepEnabled(step: PipelineStepConfig): boolean {
  return isPipelineStepEnabled(step);
}

/**
 * Walk steps in order: optional skip predicate, async execute returning a number (e.g. dispatch count),
 * optional early exit after a step (Scrum Master `stopIfDispatched`).
 */
export async function runPipelineStepSequence<T>(
  steps: readonly T[],
  options: {
    skipStep?: (step: T, index: number) => boolean;
    executeStep: (step: T, index: number) => Promise<number>;
    breakAfter?: (step: T, index: number, stepResult: number) => boolean;
  },
): Promise<void> {
  const { skipStep, executeStep, breakAfter } = options;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (skipStep?.(step, i)) continue;
    const n = await executeStep(step, i);
    if (breakAfter?.(step, i, n)) break;
  }
}

export function getResumeCursorFromCallerConfig(root: CallerConfigRoot): PipelineResumeCursor | undefined {
  const id = root.params?.async_trigger_step?.trim();
  if (!id) return undefined;
  return { asyncTriggerStepId: id };
}

/** First executable step index for this invocation from decoded `caller_config` + normalized pipeline steps. */
export function getPipelineStartIndexFromCallerRoot(
  steps: PipelineStepConfig[],
  root: CallerConfigRoot,
): number {
  return getPipelineStartIndex(steps, getResumeCursorFromCallerConfig(root));
}

/** Index of the step whose normalized `id` equals `stepId`, or `-1` if not found. */
export function findPipelineStepIndexById(steps: PipelineStepConfig[], stepId: string): number {
  const t = stepId.trim();
  if (!t) return -1;
  return steps.findIndex(s => s.id === t);
}
