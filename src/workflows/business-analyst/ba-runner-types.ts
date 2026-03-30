/**
 * Shared types for the Business Analyst pipeline runner.
 */
import type { BaOutcome } from './ba-types.js';
import type { BusinessAnalystContext, BusinessAnalystDeps } from './business-analyst-core.js';

export type { BusinessAnalystContext, BusinessAnalystDeps };

/** Mutable context passed through every step — steps write results here for downstream steps. */
export interface BaPipelineContext {
  issueKey: string;
  /** Written by llm_evaluate; read by update_issue and assign_copilot. */
  outcome?: BaOutcome;
}

export type BaStepOutcome =
  | { status: 'continue' }
  | { status: 'stop'; reason: string };

export interface BaPipelineStep {
  runner: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface BaPipelineParams {
  runner: 'pipeline';
  steps: BaPipelineStep[];
  onFailure?: {
    githubIssueComment?: string;
  };
}

export type BaPipelineDeps = BusinessAnalystDeps;
