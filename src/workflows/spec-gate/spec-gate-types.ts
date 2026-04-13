/**
 * Spec Gate — type definitions.
 *
 * The spec gate reads spec-kit artifacts after each pipeline step and uses
 * an LLM to detect open questions, clarification markers, and other blockers
 * that require human attention before the next step can proceed.
 */

/* ------------------------------------------------------------------ */
/*  Step                                                               */
/* ------------------------------------------------------------------ */

export type SpeckitStep = 'specify' | 'clarify' | 'plan' | 'tasks' | 'implement';

export const STEP_ORDER: SpeckitStep[] = [
  'specify',
  'clarify',
  'plan',
  'tasks',
  'implement',
];

/** Files to read for each step. Optional files are skipped when missing. */
export const STEP_FILES: Record<SpeckitStep, { path: string; optional?: boolean }[]> = {
  specify: [
    { path: 'spec.md' },
    { path: 'checklists/requirements.md', optional: true },
  ],
  clarify: [
    { path: 'spec.md' },
  ],
  plan: [
    { path: 'plan.md' },
    { path: 'research.md', optional: true },
    { path: 'data-model.md', optional: true },
  ],
  tasks: [
    { path: 'tasks.md' },
  ],
  implement: [
    { path: 'tasks.md' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Analysis result                                                    */
/* ------------------------------------------------------------------ */

export interface SpecIssue {
  /** Relative path within the feature directory, e.g. "spec.md" */
  file: string;
  /** 1-based line number; 0 when not applicable */
  line: number;
  /** The problematic text or marker found */
  text: string;
}

export interface GateAnalysisResult {
  /**
   * True only when zero issues are found AND the step is not "implement".
   * The implement step always yields proceed=false (hard-coded safety override).
   */
  proceed: boolean;
  issues: SpecIssue[];
  summary: string;
}
