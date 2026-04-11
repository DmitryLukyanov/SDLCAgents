/** Optional overrides inside a Jira description fenced block. */
export interface SpecKitJiraOverrides {
  /** Applied to every Spec-Kit phase (issueContext.md and headless artifacts). */
  globalDirective?: string;
  specify?: string;
  plan?: string;
  tasks?: string;
}

export interface SpecKitDefaults {
  specify: string;
  plan: string;
  tasks: string;
  /** Applied to every Spec-Kit phase unless overridden in Jira `spec-kit` JSON. */
  globalDirective?: string;
}

