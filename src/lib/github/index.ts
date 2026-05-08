/**
 * GitHub helpers for Actions workflows and CI scripts (Octokit-adjacent utilities).
 *
 * Today: job summary (`GITHUB_STEP_SUMMARY`), flexible text + table segments.
 * Add sibling modules here as needed (e.g. annotations, workflow dispatch helpers that stay UI-facing).
 */
export {
  appendGithubJobSummary,
  formatAsciiTable,
  isSummaryTableSegment,
  printJobSummaryToConsole,
  publishJobSummary,
  renderJobSummaryMarkdown,
  type JobSummarySegment,
  type SummaryTableSegment,
} from './job-summary.js';
