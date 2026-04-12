/**
 * Shared types for the pipeline runner framework.
 *
 * A pipeline is an ordered list of steps; each step runs a named runner and
 * returns a StepOutcome that tells the pipeline whether to continue or halt.
 */
import type { JiraIssue } from '../../lib/jira/jira-types.js';
import type { RelatedIssueSummary } from '../../lib/jira/jira-related.js';
import type { IssueContextPrepOptions } from './spec-kit/pipeline.js';
import type { BaOutcome, TicketContext } from '../business-analyst/ba-types.js';

export interface AiTeammateDeps {
  getIssue: (key: string, fields: string[]) => Promise<JiraIssue>;
  addIssueComment: (key: string, comment: string) => Promise<void>;
  addJiraIssueLabel: (key: string, label: string) => Promise<void>;
  transitionIssueToStatusName: (key: string, status: string) => Promise<void>;
  fetchRelatedIssueSummaries: (key: string, depth: number) => Promise<RelatedIssueSummary[]>;
  prepareSpecKitWorkspace: (opts: IssueContextPrepOptions) => Promise<void>;
  createGithubIssue: (owner: string, repo: string, issueKey: string) => Promise<number>;
  analyzeTicket: (ticketCtx: TicketContext, githubToken: string, model?: string) => Promise<BaOutcome>;
  updateGithubIssue: (owner: string, repo: string, issueNumber: number, payload: {
    body: string;
    assignees: string[];
    agentInstructions: string;
  }) => Promise<void>;
  closeGithubIssue: (owner: string, repo: string, issueNumber: number) => Promise<void>;
  addGithubIssueComment: (owner: string, repo: string, issueNumber: number, body: string) => Promise<void>;
  githubToken: string;
  model?: string;
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
  /** Written by run_ba_inline; read by assign_copilot. */
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

/** Config shape for the run_ba_inline step. */
export interface BaInlineStep extends PipelineStep {
  runner: 'run_ba_inline';
  /** Skip BA and stop pipeline if Jira ticket already has this label. */
  skipIfLabel?: string;
  /** Add this label to the Jira ticket after successful analysis. */
  addLabel?: string;
}

