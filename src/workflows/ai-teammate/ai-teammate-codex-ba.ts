/**
 * Codex BA for AI Teammate — re-exports prepare, finish, and shared artifact types/paths.
 *
 * - Prepare: `ai-teammate-codex-ba-prepare.ts` (`codex_ba_create_github_issue` / `codex_ba_prepare_prompt` / `codex_ba_prepare`).
 * - Finish: `ai-teammate-codex-ba-finish.ts` (`codex_ba_finish`).
 * - Shared: `ai-teammate-codex-ba-shared.ts` (paths, versions, JSON shapes).
 */
export {
  STATE_VERSION,
  GITHUB_ISSUE_PREP_VERSION,
  assertConcurrencyKeyMatchesIssue,
  specDir,
  codexBaPaths,
  type BaGithubIssuePrepFile,
  type BaCodexStateFile,
} from './ai-teammate-codex-ba-shared.js';

export {
  runCodexBaCreateGithubIssuePhase,
  runCodexBaPreparePromptPhase,
  runCodexBaPrepare,
  writeBaGithubIssuePrepCheckpoint,
} from './ai-teammate-codex-ba-prepare.js';

export { runCodexBaFinish } from './ai-teammate-codex-ba-finish.js';
