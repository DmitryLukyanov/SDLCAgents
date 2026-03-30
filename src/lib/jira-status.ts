/**
 * Shared Jira workflow status env helpers (Scrum Master JQL filter + ticket processor read/transition).
 */

/** Default matches typical Jira backlog column name ("To Do"). Override with REQUIRED_JIRA_STATUS. */
export function getRequiredIssueStatus(): string {
  const s = (process.env.REQUIRED_JIRA_STATUS ?? 'To Do').trim();
  return s || 'To Do';
}

export function getPostReadTargetStatus(): string {
  const s = (process.env.POST_READ_STATUS ?? 'In Progress').trim();
  return s || 'In Progress';
}

/** True for the configured backlog/status filter or the post-read target (e.g. after Scrum Master moves the ticket). */
export function statusAllowsRead(statusName: string | undefined): boolean {
  if (!statusName?.trim()) return false;
  const s = statusName.trim().toLowerCase();
  const required = getRequiredIssueStatus().toLowerCase();
  const target = getPostReadTargetStatus().toLowerCase();
  return s === required || s === target;
}

/**
 * Wrap user JQL so search only returns issues in the required status.
 * If the query ends with `ORDER BY ...`, that clause is kept at the end of the full query
 * (Jira rejects `ORDER BY` inside parentheses).
 */
export function jqlRequireStatus(baseJql: string): string {
  const status = getRequiredIssueStatus().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const raw = baseJql.trim();
  const orderMatch = raw.match(/\s+ORDER\s+BY\s+/i);
  let filterPart = raw;
  let orderPart = '';
  if (orderMatch?.index !== undefined) {
    filterPart = raw.slice(0, orderMatch.index).trim();
    orderPart = raw.slice(orderMatch.index).trim();
  }

  const core =
    filterPart.length > 0
      ? `(${filterPart}) AND status = "${status}"`
      : `status = "${status}"`;

  return orderPart ? `${core} ${orderPart}` : core;
}
