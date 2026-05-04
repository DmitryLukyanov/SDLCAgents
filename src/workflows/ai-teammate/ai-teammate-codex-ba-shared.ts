/**
 * Shared paths, versions, and JSON shapes for Codex BA prepare + finish (`async-invocation-handoff/<KEY>/`).
 */
import { join, resolve } from 'node:path';
import {
  ASYNC_INVOCATION_HANDOFF_ROOT_DIR,
  DEFAULT_AGENT_INVOCATION_CONTRACT,
  handoffWorkspacePaths,
  loadAgentInvocationContractFromConfigFile,
} from '../../lib/agent-invocation-contract.js';
import type { TicketContext } from '../business-analyst/ba-types.js';
import type { AgentLabelParams, RunnerContext } from './runner-types.js';
import type { StepRecord } from './ai-teammate-pipeline.js';

export const STATE_VERSION = 1 as const;
export const GITHUB_ISSUE_PREP_VERSION = 1 as const;

/** Written after `create_github_issue`; read by `codex_ba_prepare_prompt`. */
export interface BaGithubIssuePrepFile {
  version: typeof GITHUB_ISSUE_PREP_VERSION;
  partialRecords: StepRecord[];
  runnerCtx: Pick<
    RunnerContext,
    'issueKey' | 'owner' | 'repo' | 'ref' | 'callerConfig' | 'configFile' | 'githubIssueNumber'
  >;
}

export interface BaCodexStateFile {
  version: typeof STATE_VERSION;
  ticketCtx: TicketContext;
  agentLabelParams: AgentLabelParams;
  runnerCtx: Pick<
    RunnerContext,
    'issueKey' | 'owner' | 'repo' | 'ref' | 'callerConfig' | 'configFile' | 'githubIssueNumber'
  >;
  /** Path relative to repository root for Codex `output-file` */
  codexRelativeOutputPath: string;
  partialRecords: StepRecord[];
}

/**
 * `workflow_call` passes `concurrency_key` for artifact paths; `CALLER_CONFIG` carries the real Jira key.
 */
export function assertConcurrencyKeyMatchesIssue(issueKey: string): void {
  const w = process.env['AI_TEAMMATE_CONCURRENCY_KEY']?.trim();
  if (!w) return;
  if (w !== issueKey) {
    throw new Error(
      `AI Teammate concurrency_key mismatch: workflow input is "${w}" but CALLER_CONFIG resolves to "${issueKey}". ` +
        'Use the same Jira issue key for `concurrency_key` and inside `caller_config`.',
    );
  }
}

export function specDir(issueKey: string): string {
  return join(process.cwd(), ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey);
}

/** Default handoff layout (invocation contract defaults). Prefer {@link handoffWorkspacePaths} when config supplies `contract`. */
export function codexBaPaths(issueKey: string) {
  const { base, state, inputPaths, githubIssuePrep } = handoffWorkspacePaths(
    issueKey,
    DEFAULT_AGENT_INVOCATION_CONTRACT,
  );
  return { base, state, prompt: inputPaths['prompt']!, githubIssuePrep };
}

/** Resolve handoff paths from `CONFIG_FILE` + async step `contract`. */
export function loadHandoffPathsFromConfig(issueKey: string): ReturnType<typeof handoffWorkspacePaths> {
  const configFile = process.env.CONFIG_FILE?.trim();
  if (!configFile) throw new Error('CONFIG_FILE is required for invocation contract / handoff paths');
  const contract = loadAgentInvocationContractFromConfigFile(resolve(process.cwd(), configFile));
  return handoffWorkspacePaths(issueKey, contract);
}
