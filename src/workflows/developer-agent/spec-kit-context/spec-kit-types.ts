/** Optional overrides inside a Jira description fenced block. */
export interface SpecKitJiraOverrides {
  /** Applied to every spec-kit phase (issueContext.md and headless artifacts). */
  globalDirective?: string;
  specify?: string;
  plan?: string;
  tasks?: string;
}

export interface SpecKitDefaults {
  specify: string;
  plan: string;
  tasks: string;
  /** Applied to every spec-kit phase unless overridden in Jira JSON/spec-kit block. */
  globalDirective?: string;
}
