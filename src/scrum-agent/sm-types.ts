/** Scrum Master rules (dmtools-style: JQL + agent config path + optional labels). */

export interface SmRule {
  description?: string;
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
}

export interface SmConfig {
  rules: SmRule[];
}
