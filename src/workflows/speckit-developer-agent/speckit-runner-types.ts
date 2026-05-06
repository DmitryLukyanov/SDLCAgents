/**
 * Shared types for the speckit-developer-agent pipeline runner.
 *
 * Similar to AI-Teammate runner types but adapted for spec-kit workflow.
 */

/** Record of a single pipeline step execution (persisted for resume). */
export interface StepRecord {
  runner: string;
  status: 'continue' | 'stop';
  reason?: string;
  durationMs: number;
  /** Set on resume: whether the step ran in this invocation or was replayed from a checkpoint. */
  source?: 'prepare_checkpoint' | 'this_invocation';
  /** For spec_kit_step runner: which spec-kit step (specify, clarify, etc.) */
  stepName?: string;
}

/** Dependencies for spec-kit pipeline operations */
export interface SpeckitDeveloperAgentDeps {
  /** Create or update PR on GitHub */
  createOrUpdatePR: (
    owner: string,
    repo: string,
    branchName: string,
    title: string,
    body: string,
    draft: boolean,
  ) => Promise<number>;
  /** Post a comment on PR */
  addPRComment: (owner: string, repo: string, prNumber: number, body: string) => Promise<void>;
  /** Update PR draft status */
  updatePRDraft: (owner: string, repo: string, prNumber: number, draft: boolean) => Promise<void>;
  /** Get issue from Jira (optional) */
  getJiraIssue?: (key: string) => Promise<{ summary: string; description: string }>;
}

/** Context passed to every step runner — static inputs plus mutable pipeline state. */
export interface RunnerContext {
  /** Jira issue key (e.g., PROJ-123) */
  issueKey: string;
  /** GitHub issue number */
  issueNumber?: number;
  /** GitHub repo owner */
  owner: string;
  /** GitHub repo name */
  repo: string;
  /** Git ref for workflow */
  ref: string;
  /** URL-encoded JSON from workflow caller_config / env CALLER_CONFIG */
  callerConfig: string;
  /** Path to agent config file */
  configFile: string;
  /** Feature branch name */
  branchName?: string;
  /** PR number */
  prNumber?: number;
  /** Feature directory path (e.g., .specify/features/PROJ-123) */
  featureDir?: string;
  /** Prior step records from pipeline execution (used for checkpoint/resume) */
  priorStepRecords?: StepRecord[];
  /** Model to use for Codex */
  model?: string;
}

/**
 * Every runner returns one of two outcomes:
 *   continue — pipeline moves on to the next step
 *   stop     — pipeline halts immediately (no further steps run)
 */
export type StepOutcome =
  | { status: 'continue' }
  | { status: 'stop'; reason: string };

/** A single step inside a pipeline config */
export interface PipelineStep {
  id?: string;
  runner: string;
  enabled?: boolean;
  /** For spec_kit_step runner: which spec-kit step to execute */
  stepName?: string;
  async_call?: {
    workflowFile: string;
    workflowRef?: string;
    terminal?: boolean;
    inputs?: Record<string, string>;
  };
  [key: string]: unknown;
}

/** Spec-kit state persisted between steps */
export interface SpeckitState {
  completedSteps: string[];
  nextStep: string | null;
  lastUpdated: string;
  issueNumber: number;
  issueKey: string;
  prNumber: number;
  branchName: string;
  featureDir?: string;
  /** Pipeline step records for resume capability */
  pipelineRecords?: StepRecord[];
  /** State version for compatibility */
  version?: number;
}
