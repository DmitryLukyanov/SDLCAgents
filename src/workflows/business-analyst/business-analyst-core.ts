/**
 * Business Analyst shared helpers used by the inline BA step (run_ba_inline).
 */

import type { JiraIssueFields } from '../../lib/jira/jira-types.js';
import type { RelatedIssueSummary } from '../../lib/jira/jira-related.js';
import { adfToPlain } from '../../lib/adf-to-plain.js';
import type { JiraComment, RelatedIssueBrief } from './ba-types.js';

export const BA_COMMENT_MARKERS = [
  '🤖 Business Analyst — Missing Information',
  'Business Analyst — Missing Information',
  'Business Analyst analysis complete',
  'Ticket taken into processing',
];

export function isBAGeneratedComment(body: string): boolean {
  return BA_COMMENT_MARKERS.some((marker) => body.includes(marker));
}

export function extractComments(fields: JiraIssueFields | undefined): JiraComment[] {
  const raw = fields?.comment?.comments ?? [];
  return raw.map((c) => {
    const body = adfToPlain(c.body);
    return {
      author: c.author?.displayName ?? 'Unknown',
      body,
      created: c.created ?? '',
      isBAGenerated: isBAGeneratedComment(body),
    };
  });
}

export function mapRelated(items: RelatedIssueSummary[]): RelatedIssueBrief[] {
  return items.map((r) => ({
    key: r.key,
    summary: r.summary ?? '(no summary)',
    status: r.status ?? 'Unknown',
    type: r.issuetype ?? 'Unknown',
  }));
}
