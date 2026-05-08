/**
 * One `sm_dispatch_rule` pipeline step: JQL + paths passed through to `workflow_dispatch`.
 * Defined under `params.steps[]` in `scrum-master.config` (same pipeline shape as other agents).
 */
export interface SmDispatchStep {
  description?: string;
  /**
   * Jira status filter for this step’s JQL (default: env `REQUIRED_JIRA_STATUS` or "To Do").
   * When set, overrides env for the duration of this step only.
   */
  requiredJiraStatus?: string;
  /**
   * Jira status after dispatch for issues matched by this step (default: env `POST_READ_STATUS` or "In Progress").
   * When set, overrides env for the duration of this step only.
   */
  postReadStatus?: string;
  /** JQL; optional placeholders: {jiraProject} from env JIRA_PROJECT */
  jql: string;
  /** Path to agent JSON in repo (passed as workflow config_file input). */
  configFile: string;
  /** GitHub Actions workflow filename (`.yml` / `.yaml`); required when the step is enabled. */
  workflowFile?: string;
  /** Max issues for this step (falls back to global limit from env). */
  limit?: number;
  /** Skip issue if it already has this label. */
  skipIfLabel?: string;
  /** Add label after successful workflow dispatch (idempotency marker). */
  addLabel?: string;
  /** Set false to disable a step without removing it. */
  enabled?: boolean;
  /** If true and this step dispatches at least one workflow, stop processing further steps. */
  stopIfDispatched?: boolean;
}
