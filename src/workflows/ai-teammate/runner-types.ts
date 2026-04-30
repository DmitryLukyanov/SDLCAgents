/**
 * Shared types for the pipeline runner framework.
 *
 * A pipeline is an ordered list of steps; each step runs a named runner and
 * returns a StepOutcome that tells the pipeline whether to continue or halt.
 */
import type { JiraIssue } from '../../lib/jira/jira-types.js';
import type { RelatedIssueSummary } from '../../lib/jira/jira-related.js';
import type { IssueContextPrepOptions } from './spec-kit/pipeline.js';
import type { BaOutcome } from '../business-analyst/ba-types.js';

/** Used by `assign_copilot` to set issue body, assignees, and Copilot agent instructions. */
export interface GithubCopilotIssueUpdate {
  body: string;
  assignees: string[];
  agentInstructions: string;
}

export interface AiTeammateDeps {
  getIssue: (key: string, fields: string[]) => Promise<JiraIssue>;
  addIssueComment: (key: string, comment: string) => Promise<void>;
  addJiraIssueLabel: (key: string, label: string) => Promise<void>;
  transitionIssueToStatusName: (key: string, status: string) => Promise<void>;
  fetchRelatedIssueSummaries: (key: string, depth: number) => Promise<RelatedIssueSummary[]>;
  prepareSpecKitWorkspace: (opts: IssueContextPrepOptions) => Promise<void>;
  createGithubIssue: (owner: string, repo: string, issueKey: string) => Promise<number>;
  /** Update the GitHub issue body (no Copilot assignment). */
  updateGithubIssueBody: (owner: string, repo: string, issueNumber: number, body: string) => Promise<void>;
  /** Update issue for Copilot Coding Agent (body, assignees, agent instructions). */
  updateGithubIssue: (
    owner: string,
    repo: string,
    issueNumber: number,
    payload: GithubCopilotIssueUpdate,
  ) => Promise<void>;
  /** Dispatch the developer agent workflow in the consumer repo. */
  dispatchDeveloperAgent: (
    owner: string,
    repo: string,
    workflowFile: string,
    ref: string,
    inputs: { issue_number: string; issue_key: string; step: string; branch_name?: string },
  ) => Promise<void>;
  closeGithubIssue: (owner: string, repo: string, issueNumber: number) => Promise<void>;
  addGithubIssueComment: (owner: string, repo: string, issueNumber: number, body: string) => Promise<void>;
}

/** Context passed to every step runner — static inputs plus mutable pipeline state. */
export interface RunnerContext {
  issueKey: string;
  owner: string;
  repo: string;
  ref: string;
  encodedConfig: string;
  configFile: string;
  /** Written by create_github_issue; read by subsequent steps. */
  githubIssueNumber?: number;
  /** Written by print_jira_context_to_stdout after spec-kit prep; read by assign_copilot. */
  specKitContextFile?: string;
  /** Set after BA (Codex) analysis; read by `start_developer_agent`. */
  baOutcome?: BaOutcome;
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

/** Config for the BA phase (Codex reads this step from the pipeline JSON). */
export interface BaInlineStep extends PipelineStep {
  runner: 'run_ba_inline';
  /** Skip BA and stop pipeline if Jira ticket already has this label. */
  skipIfLabel?: string;
  /** Add this label to the Jira ticket after successful analysis. */
  addLabel?: string;
}

