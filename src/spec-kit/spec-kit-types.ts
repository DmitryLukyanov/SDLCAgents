/** Optional overrides inside a Jira description fenced block. */
export interface SpecKitJiraOverrides {
  /** Applied to every Spec-Kit phase (context.md and headless artifacts). */
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

/** CLI-mode configuration for real spec-kit (specify-cli) invocation. */
export interface SpecKitCliConfig {
  cliEnabled?: boolean;
  /** Git tag or branch, e.g. "v0.4.0" */
  version?: string;
  /** AI backend, e.g. "copilot" */
  agent?: string;
  /** Script type for `specify init`, e.g. "sh" */
  scriptType?: string;
}

/** Manifest written by Node, consumed by workflow shell steps. */
export interface SpecKitManifest {
  issueKey: string;
  contextFile: string;
  constitutionFile: string;
  outputDir: string;
  version: string;
  agent: string;
  scriptType: string;
}
