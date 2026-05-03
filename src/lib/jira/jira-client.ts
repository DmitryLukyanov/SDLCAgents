/**
 * Minimal Jira Cloud REST client (Basic auth: email + API token).
 */
import type {
  JiraIssue,
  JiraSearchIssue,
  JiraSearchResponse,
  JiraTransitionsResponse,
} from './jira-types.js';

/** One page from POST /rest/api/3/search/jql (enhanced search). */
interface JiraSearchJqlPage {
  issues?: JiraSearchIssue[];
  isLast?: boolean;
  nextPageToken?: string;
}

const base = (): string => {
  const u = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  if (!u) throw new Error('JIRA_BASE_URL is required');
  return u;
};

function authHeader(): string {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error('JIRA_EMAIL and JIRA_API_TOKEN are required');
  const b64 = Buffer.from(`${email}:${token}`, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

async function jiraFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${base()}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: authHeader(),
    ...(init.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const errBody = body as { errorMessages?: string[] } | string | null;
    const msg =
      typeof errBody === 'object' && errBody?.errorMessages?.length
        ? errBody.errorMessages.join('; ')
        : String(text).slice(0, 500);
    throw new Error(`Jira ${res.status} ${res.statusText}: ${msg}`);
  }
  return body as T;
}

/**
 * Validates Jira credentials by calling /rest/api/3/myself.
 * Throws a clear error if the API token is invalid or expired.
 */
export async function validateJiraAuth(): Promise<string> {
  try {
    const me = await jiraFetch<{ displayName?: string; emailAddress?: string }>(
      '/rest/api/3/myself',
    );
    const identity = me.displayName || me.emailAddress || 'unknown';
    console.log(`✅ Jira auth OK (${identity})`);
    return identity;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Jira authentication failed — check JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN secrets. Details: ${msg}`,
    );
  }
}

export async function searchIssues(
  jql: string,
  maxResults: number,
  fields: string[] = ['key'],
): Promise<JiraSearchResponse> {
  if (maxResults <= 0) {
    return { issues: [] };
  }

  const issues: JiraSearchIssue[] = [];
  let nextPageToken: string | undefined;

  while (issues.length < maxResults) {
    const remaining = maxResults - issues.length;
    const body: Record<string, unknown> = {
      jql,
      maxResults: remaining,
      fields,
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const page = await jiraFetch<JiraSearchJqlPage>('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const batch = page.issues ?? [];
    issues.push(...batch);

    if (issues.length >= maxResults) {
      break;
    }
    if (page.isLast) {
      break;
    }
    if (!page.nextPageToken) {
      break;
    }
    nextPageToken = page.nextPageToken;
  }

  return { issues: issues.slice(0, maxResults) };
}

/** Minimal Atlassian Document Format document: one paragraph of plain text. */
function adfDocFromPlainText(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

export async function addIssueComment(issueKey: string, plainText: string): Promise<void> {
  await jiraFetch<unknown>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: adfDocFromPlainText(plainText) }),
  });
}

export async function addIssueLabel(issueKey: string, label: string): Promise<void> {
  await jiraFetch<unknown>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    body: JSON.stringify({
      update: {
        labels: [{ add: label }],
      },
    }),
  });
}

export async function getIssue(issueKey: string, fields: string[]): Promise<JiraIssue> {
  const q = new URLSearchParams();
  if (fields.length) q.set('fields', fields.join(','));
  const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}${q.toString() ? `?${q}` : ''}`;
  return jiraFetch<JiraIssue>(path);
}

/** Label names on the issue (shared helper for skip-if-label and other agents). */
export async function getIssueLabelNames(issueKey: string): Promise<string[]> {
  const issue = await getIssue(issueKey, ['labels']);
  return issue.fields?.labels ?? [];
}

async function getTransitions(issueKey: string): Promise<JiraTransitionsResponse> {
  return jiraFetch<JiraTransitionsResponse>(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
  );
}

async function transitionIssue(issueKey: string, transitionId: string): Promise<void> {
  await jiraFetch<unknown>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
    method: 'POST',
    body: JSON.stringify({
      transition: { id: transitionId },
    }),
  });
}

/**
 * Finds a transition whose destination status name matches (case-insensitive) and performs it.
 */
export async function transitionIssueToStatusName(
  issueKey: string,
  targetStatusName: string,
): Promise<void> {
  const want = targetStatusName.trim().toLowerCase();
  if (!want) throw new Error('targetStatusName is empty');

  const { transitions } = await getTransitions(issueKey);
  const match = transitions.find((t) => (t.to?.name ?? '').trim().toLowerCase() === want);

  if (!match) {
    const available = transitions
      .map((t) => `"${t.to?.name ?? '?'}" (transition: ${t.name ?? t.id})`)
      .join('; ');
    throw new Error(
      `No transition to status "${targetStatusName}" for ${issueKey}. Available destinations: ${available || '(none)'}`,
    );
  }

  await transitionIssue(issueKey, match.id);
}
