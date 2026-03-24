/**
 * Dummy agent: load one Jira issue, optional related-ticket context, print, transition status.
 */
import { fetchRelatedIssueSummaries } from '../jira/jira-related.js';
import { getIssue, transitionIssueToStatusName } from '../jira/jira-client.js';
import {
  getPostReadTargetStatus,
  getRequiredIssueStatus,
  statusAllowsRead,
} from '../lib/jira-status.js';
import { adfToPlain } from './adf-to-plain.js';

/** Default 1 = linked issues + child issues (see jira-related.ts), matching typical dmtools ticketContextDepth. Set TICKET_CONTEXT_DEPTH=0 to disable. */
function getTicketContextDepth(): number {
  const raw = process.env.TICKET_CONTEXT_DEPTH?.trim();
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

export async function runDummyTicketAgent(): Promise<void> {
  const issueKey = process.env.ISSUE_KEY?.trim();
  if (!issueKey) {
    throw new Error('ISSUE_KEY is required');
  }

  const fields = [
    'summary',
    'description',
    'issuetype',
    'status',
    'priority',
    'assignee',
    'reporter',
    'created',
    'updated',
    'comment',
  ];

  const issue = await getIssue(issueKey, fields);
  const f = issue.fields;

  const statusName = f?.status?.name;
  const required = getRequiredIssueStatus();
  if (!statusAllowsRead(statusName)) {
    console.error(
      `Refusing to read ${issueKey}: status is "${statusName ?? '(none)'}", required "${required}".`,
    );
    process.exit(1);
  }

  const depth = getTicketContextDepth();

  console.log('--- Jira ticket (dummy agent) ---');
  console.log(`Key:     ${issue.key}`);
  console.log(`Summary: ${f?.summary ?? '(none)'}`);
  console.log(`Type:    ${f?.issuetype?.name ?? '(none)'}`);
  console.log(`Status:  ${f?.status?.name ?? '(none)'}`);
  console.log(`Priority:${f?.priority?.name ?? '(none)'}`);
  console.log(
    `Assignee:${f?.assignee?.displayName ?? f?.assignee?.emailAddress ?? '(unassigned)'}`,
  );
  console.log(
    `Reporter:${f?.reporter?.displayName ?? f?.reporter?.emailAddress ?? '(unknown)'}`,
  );
  console.log(`Created: ${f?.created ?? '(none)'}`);
  console.log(`Updated: ${f?.updated ?? '(none)'}`);
  console.log('');
  console.log('Description:');
  console.log(adfToPlain(f?.description) || '(empty)');
  console.log('');

  if (depth >= 1) {
    console.log(`--- Related tickets (ticketContextDepth=${depth}) ---`);
    const related = await fetchRelatedIssueSummaries(issueKey, depth);
    if (related.length === 0) {
      console.log('(no linked issues or child issues found)');
    } else {
      const testCases = related.filter((r) => (r.issuetype ?? '').toLowerCase() === 'test case');
      if (testCases.length > 0) {
        console.log(
          `Linked Test Case issue(s): ${testCases.length} — review steps/status before fixing.`,
        );
      }
      for (const r of related) {
        const rel = r.relation === 'link' ? 'link' : 'subtask/child';
        console.log(
          `  [${rel}] ${r.key} · ${r.issuetype ?? '?'} · ${r.status ?? '?'} · ${r.summary ?? '(no summary)'}`,
        );
      }
    }
    console.log('');
  }

  const comments = f?.comment?.comments ?? [];
  console.log(`Comments (${comments.length}):`);
  for (const c of comments) {
    const who = c.author?.displayName ?? '?';
    const when = c.created ?? '';
    const text = adfToPlain(c.body);
    console.log(`  [${when}] ${who}:`);
    console.log(text.split('\n').map((line) => `    ${line}`).join('\n'));
  }
  console.log('--- end ---');

  const nextStatus = getPostReadTargetStatus();
  if ((statusName ?? '').trim().toLowerCase() === nextStatus.trim().toLowerCase()) {
    console.log(`${issueKey} already in "${nextStatus}" (e.g. moved by Scrum Master); skipping transition.`);
  } else {
    console.log(`Moving ${issueKey} to status "${nextStatus}"...`);
    await transitionIssueToStatusName(issueKey, nextStatus);
    console.log(`Status updated to "${nextStatus}".`);
  }
}
