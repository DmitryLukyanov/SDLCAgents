/**
 * Codex BA for AI Teammate — helpers for async handoff + resume.
 *
 * These helpers are used by the config-driven pipeline (`AI_TEAMMATE_MODE=pipeline_ci`).
 * - Shared: `ai-teammate-codex-ba-shared.ts` (paths, versions, JSON shapes).
 */
export {
  STATE_VERSION,
  GITHUB_ISSUE_PREP_VERSION,
  assertConcurrencyKeyMatchesIssue,
  specDir,
  codexBaPaths,
  loadHandoffPathsFromConfig,
  type BaGithubIssuePrepFile,
  type BaCodexStateFile,
} from './ai-teammate-codex-ba-shared.js';

export {
  writeBaGithubIssuePrepCheckpoint,
} from './ai-teammate-codex-ba-prepare.js';

export { runCodexBaFinish } from './ai-teammate-codex-ba-finish.js';
