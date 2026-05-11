/**
 * Shared spec-kit step ordering and `speckit-state.json` core shape for
 * github-bootstrap, codex-prepare, teardown, legacy agent, and pipeline.
 */

export const SPECKIT_STEP_ORDER = [
  'specify',
  'clarify',
  'plan',
  'tasks',
  'implement',
  'code_review',
] as const;

export type SpeckitStep = (typeof SPECKIT_STEP_ORDER)[number];

/** Core persisted fields in `speckit-state.json` (pipeline may add version, records, etc.). */
export interface SpeckitWorkflowBaseState {
  completedSteps: SpeckitStep[];
  nextStep: SpeckitStep | null;
  lastUpdated: string;
  issueNumber: number;
  issueKey: string;
  prNumber: number;
  branchName: string;
  featureDir?: string;
}

export function parseSpeckitStep(raw: string): SpeckitStep {
  const s = raw.trim().toLowerCase().replace(/-/g, '_');
  if (!(SPECKIT_STEP_ORDER as readonly string[]).includes(s)) {
    throw new Error(`Unknown STEP "${raw}". Expected one of: ${SPECKIT_STEP_ORDER.join(', ')}`);
  }
  return s as SpeckitStep;
}

export function nextSpeckitStepAfter(step: SpeckitStep): SpeckitStep | null {
  const idx = SPECKIT_STEP_ORDER.indexOf(step);
  return idx >= 0 && idx < SPECKIT_STEP_ORDER.length - 1 ? SPECKIT_STEP_ORDER[idx + 1] : null;
}

export function speckitStepLabel(step: SpeckitStep): string {
  return `${step} (${SPECKIT_STEP_ORDER.indexOf(step) + 1}/${SPECKIT_STEP_ORDER.length})`;
}
