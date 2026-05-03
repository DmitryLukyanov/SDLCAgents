/**
 * Helpers for the **expected** first pipeline step on an invocation (fresh vs resume after async).
 * Pure functions — no I/O. Pair with `pipeline-config.ts` for normalized step ids.
 */

import type { CallerConfigRoot } from './caller-config.js';
import type { PipelineStepConfig } from './pipeline-config.js';

export interface PipelineResumeCursor {
  /** `caller_config.params.async_trigger_step` — stable step id (inclusive skip boundary). */
  asyncTriggerStepId: string;
}

/**
 * Index of the first step to execute on this invocation.
 * - Fresh run: 0.
 * - Resume: first index **after** the step whose `id` matches `async_trigger_step` (that step is skipped inclusive).
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

export function isStepEnabled(step: PipelineStepConfig): boolean {
  return step.enabled !== false;
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
