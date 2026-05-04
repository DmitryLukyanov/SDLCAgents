/**
 * Jira-only markdown for the GitHub issue body snapshot (no spec-kit defaults or Jira JSON blocks).
 */
import { getIssue as jiraGetIssue } from '../../lib/jira/jira-client.js';
import type { JiraIssue } from '../../lib/jira/jira-types.js';
import {
  getPostReadTargetStatus,
  getRequiredIssueStatus,
  statusAllowsRead,
} from '../../lib/jira-status.js';
import { adfToPlain } from '../../lib/adf-to-plain.js';
import {
  fetchRelatedIssueSummaries as jiraFetchRelatedIssueSummaries,
  type RelatedIssueSummary,
} from '../../lib/jira/jira-related.js';

/**
 * Marks the start of the Jira snapshot block in the GitHub issue **body** (or legacy issue comments).
 * Downstream steps strip everything before this marker when reading `{{JIRA_CONTEXT}}`.
 */
export const JIRA_CONTEXT_GITHUB_COMMENT_MARKER = '<!-- sdlc-agents:jira-context -->' as const;

/** Extract markdown after the Jira snapshot marker, or empty string if the marker is absent. */
export function extractJiraSnapshotMarkdownAfterMarker(text: string): string {
  if (!text.includes(JIRA_CONTEXT_GITHUB_COMMENT_MARKER)) return '';
  const idx = text.indexOf(JIRA_CONTEXT_GITHUB_COMMENT_MARKER);
  return text
    .slice(idx + JIRA_CONTEXT_GITHUB_COMMENT_MARKER.length)
    .replace(/^\s*\n/, '')
    .trim();
}

function formatRelated(items: RelatedIssueSummary[]): string {
  if (items.length === 0) return '(none)';
  return items
    .map(
      (r) =>
        `- **${r.key}** (${r.relation}) [${r.issuetype ?? '?'} / ${r.status ?? '?'}]: ${r.summary ?? '(no summary)'}`,
    )
    .join('\n');
}

export interface MinimalJiraGithubCommentOptions {
  issueKey: string;
  ticketContextDepth?: number;
  /** Defaults to `jira-client` (production); tests inject `deps.getIssue`. */
  getIssue?: (key: string, fields: string[]) => Promise<JiraIssue>;
  /** Defaults to `jira-related` (production); tests inject `deps.fetchRelatedIssueSummaries`. */
  fetchRelatedIssueSummaries?: (key: string, depth: number) => Promise<RelatedIssueSummary[]>;
}

/**
 * Markdown for posting on the GitHub issue (Jira fields + related issues only).
 * Enforces the same Jira status rules as the former ticket snapshot.
 */
export async function buildMinimalJiraGithubCommentMarkdown(
  opts: MinimalJiraGithubCommentOptions,
): Promise<string> {
  const getIssueFn = opts.getIssue ?? jiraGetIssue;
  const fetchRelatedFn = opts.fetchRelatedIssueSummaries ?? jiraFetchRelatedIssueSummaries;
  const issue = await getIssueFn(opts.issueKey, ['summary', 'description', 'status']);
  const statusName = issue.fields?.status?.name;
  if (!statusAllowsRead(statusName)) {
    throw new Error(
      `Refusing to build Jira context for ${opts.issueKey}: status is "${statusName ?? '(none)'}", ` +
        `allowed: "${getRequiredIssueStatus()}" or "${getPostReadTargetStatus()}" (see jira-status / env).`,
    );
  }
  const summary = issue.fields?.summary?.trim() || '(no summary)';
  const descPlain = adfToPlain(issue.fields?.description);

  const depth = opts.ticketContextDepth ?? 1;
  const related = depth >= 1 ? await fetchRelatedFn(opts.issueKey, depth) : [];

  return [
    `# Jira: ${opts.issueKey}`,
    '',
    `**Summary:** ${summary}`,
    '',
    '### Description',
    '',
    descPlain || '(empty)',
    '',
    '## Related issues',
    '',
    formatRelated(related),
    '',
  ].join('\n');
}
