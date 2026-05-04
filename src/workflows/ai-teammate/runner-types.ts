/**
 * Shared types for the pipeline runner framework.
 *
 * A pipeline is an ordered list of steps; each step runs a named runner and
 * returns a StepOutcome that tells the pipeline whether to continue or halt.
 */
import type { JiraIssue } from '../../lib/jira/jira-types.js';
import type { RelatedIssueSummary } from '../../lib/jira/jira-related.js';
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
  /** Reads the Jira snapshot from the GitHub issue comment marked with `JIRA_CONTEXT_GITHUB_COMMENT_MARKER`. */
  fetchJiraContextFromGithubIssue: (owner: string, repo: string, issueNumber: number) => Promise<string>;
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
  /** URL-encoded JSON from workflow `caller_config` / env `CALLER_CONFIG`. */
  callerConfig: string;
  configFile: string;
  /** Written by create_github_issue; read by subsequent steps. */
  githubIssueNumber?: number;
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

/** A single step inside a pipeline config (see `src/lib/pipeline-config.ts` for `async_call` / `id`). */
export interface PipelineStep {
  id?: string;
  runner: string;
  enabled?: boolean;
  async_call?: { workflowFile: string; workflowRef?: string; inputs?: Record<string, string> };
  [key: string]: unknown;
}

/**
 * Shared Jira label gate on agent `params` (same idea as scrum-master rules):
 * CI may skip a segment if `skipIfLabel` is present on the ticket; runners may `addLabel` after success.
 */
export interface AgentLabelParams {
  skipIfLabel?: string;
  addLabel?: string;
}

