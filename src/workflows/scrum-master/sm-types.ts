/** One Scrum Master query: JQL + paths passed through to workflow_dispatch. */

export interface SmRule {
  description?: string;
  /**
   * Jira status filter for this rule’s JQL (default: env `REQUIRED_JIRA_STATUS` or "To Do").
   * When set, overrides env for the duration of this rule only.
   */
  requiredJiraStatus?: string;
  /**
   * Jira status after dispatch for issues matched by this rule (default: env `POST_READ_STATUS` or "In Progress").
   * When set, overrides env for the duration of this rule only.
   */
  postReadStatus?: string;
  /** JQL; optional placeholders: {jiraProject} from env JIRA_PROJECT */
  jql: string;
  /** Path to agent JSON in repo (passed as workflow config_file input). */
  configFile: string;
  /** GitHub Actions workflow filename (default: ai-teammate.yml). */
  workflowFile?: string;
  /** Git ref for dispatch (default: GITHUB_REF_NAME / main). */
  workflowRef?: string;
  /** Max issues for this rule (falls back to global limit from env). */
  limit?: number;
  /** Skip issue if it already has this label. */
  skipIfLabel?: string;
  /** Add label after successful workflow dispatch (idempotency marker). */
  addLabel?: string;
  /** Set false to disable a rule without removing it. */
  enabled?: boolean;
  /** If true and this rule dispatches at least one workflow, stop processing further rules. */
  stopIfDispatched?: boolean;
}

export interface SmConfig {
  rules: SmRule[];
}
