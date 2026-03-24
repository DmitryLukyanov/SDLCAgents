/** Optional overrides inside a Jira description fenced block. */
export interface SpecKitJiraOverrides {
  specify?: string;
  plan?: string;
  tasks?: string;
}

export interface SpecKitDefaults {
  specify: string;
  plan: string;
  tasks: string;
}
