/**
 * Related-ticket context: linked issues + children of the primary issue.
 */
import { searchIssues } from './jira-client.js';

const MAX_RELATED = 25;

export interface RelatedIssueSummary {
  key: string;
  /** How this issue relates to the primary ticket. */
  relation: 'link' | 'child';
  summary?: string;
  status?: string;
  issuetype?: string;
}

function escapeKeyForLinkedIssues(key: string): string {
  return key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Depth 1: direct links (`issue in linkedIssues(...)`) and issues where `parent` is the primary key.
 * Deeper levels are not expanded (default ticketContextDepth is 1).
 */
export async function fetchRelatedIssueSummaries(
  primaryKey: string,
  depth: number,
): Promise<RelatedIssueSummary[]> {
  if (depth < 1) return [];

  const seen = new Set<string>([primaryKey.toUpperCase()]);
  const out: RelatedIssueSummary[] = [];

  const pushIssues = (
    issues: Array<{ key: string; fields?: Record<string, unknown> }>,
    relation: RelatedIssueSummary['relation'],
  ) => {
    for (const issue of issues) {
      const k = issue.key.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const fld = issue.fields as {
        summary?: string;
        status?: { name?: string };
        issuetype?: { name?: string };
      };
      out.push({
        key: issue.key,
        relation,
        summary: fld?.summary,
        status: fld?.status?.name,
        issuetype: fld?.issuetype?.name,
      });
    }
  };

  const safe = escapeKeyForLinkedIssues(primaryKey);

  try {
    const linked = await searchIssues(`issue in linkedIssues("${safe}")`, MAX_RELATED, [
      'key',
      'summary',
      'status',
      'issuetype',
    ]);
    pushIssues(linked.issues ?? [], 'link');
  } catch (e) {
    console.warn('Could not fetch linked issues (non-fatal):', e);
  }

  try {
    const children = await searchIssues(`parent = ${primaryKey}`, MAX_RELATED, [
      'key',
      'summary',
      'status',
      'issuetype',
    ]);
    pushIssues(children.issues ?? [], 'child');
  } catch (e) {
    console.warn('Could not fetch child issues (non-fatal):', e);
  }

  return out;
}
