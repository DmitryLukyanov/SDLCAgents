/**
 * Shared paths, versions, and JSON shapes for Codex BA prepare + finish (`spec-output/<KEY>/`).
 */
import { join } from 'node:path';
import type { TicketContext } from '../business-analyst/ba-types.js';
import type { BaInlineStep, RunnerContext } from './runner-types.js';
import type { StepRecord } from './ai-teammate-pipeline.js';

export const STATE_VERSION = 1 as const;
export const GITHUB_ISSUE_PREP_VERSION = 1 as const;

/** Written after `create_github_issue`; read by `codex_ba_prepare_prompt`. */
export interface BaGithubIssuePrepFile {
  version: typeof GITHUB_ISSUE_PREP_VERSION;
  partialRecords: StepRecord[];
  runnerCtx: Pick<
    RunnerContext,
    'issueKey' | 'owner' | 'repo' | 'ref' | 'encodedConfig' | 'configFile' | 'githubIssueNumber' | 'specKitContextFile'
  >;
}

export interface BaCodexStateFile {
  version: typeof STATE_VERSION;
  ticketCtx: TicketContext;
  baStep: BaInlineStep;
  runnerCtx: Pick<
    RunnerContext,
    'issueKey' | 'owner' | 'repo' | 'ref' | 'encodedConfig' | 'configFile' | 'githubIssueNumber' | 'specKitContextFile'
  >;
  /** Path relative to repository root for Codex `output-file` */
  codexRelativeOutputPath: string;
  partialRecords: StepRecord[];
}

/**
 * `workflow_call` passes `concurrency_key` for artifact paths; `ENCODED_CONFIG` carries the real Jira key.
 */
export function assertConcurrencyKeyMatchesIssue(issueKey: string): void {
  const w = process.env['AI_TEAMMATE_CONCURRENCY_KEY']?.trim();
  if (!w) return;
  if (w !== issueKey) {
    throw new Error(
      `AI Teammate concurrency_key mismatch: workflow input is "${w}" but ENCODED_CONFIG resolves to "${issueKey}". ` +
        'Use the same Jira issue key for `concurrency_key` and inside `encoded_config`.',
    );
  }
}

export function specDir(issueKey: string): string {
  return join(process.cwd(), 'spec-output', issueKey);
}

export function codexBaPaths(issueKey: string) {
  const base = specDir(issueKey);
  return {
    base,
    state: join(base, 'ba-codex-state.json'),
    prompt: join(base, 'ba-codex-prompt.md'),
    githubIssuePrep: join(base, 'ba-github-issue-prep.json'),
  };
}
