/** Minimal shapes for Jira Cloud REST v3 responses we use. */

export interface JiraSearchIssue {
  key: string;
  fields?: {
    labels?: string[];
    summary?: string;
    status?: { name?: string };
    issuetype?: { name?: string };
  };
}

export interface JiraSearchResponse {
  total?: number;
  issues: JiraSearchIssue[];
}

export interface JiraIssueFields {
  summary?: string;
  description?: unknown;
  issuetype?: { name?: string };
  status?: { name?: string };
  priority?: { name?: string };
  assignee?: { displayName?: string; emailAddress?: string } | null;
  reporter?: { displayName?: string; emailAddress?: string } | null;
  created?: string;
  updated?: string;
  comment?: {
    comments?: Array<{
      author?: { displayName?: string };
      body?: unknown;
      created?: string;
    }>;
  };
}

export interface JiraIssue {
  key: string;
  fields?: JiraIssueFields;
}

export interface JiraTransition {
  id: string;
  name?: string;
  to?: { name?: string; id?: string };
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}
