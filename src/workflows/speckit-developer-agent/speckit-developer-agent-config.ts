/**
 * SpecKit Developer Agent configuration types and loading.
 *
 * Mirrors the pattern used by AI Teammate (ai-teammate-agent.ts + pipeline config).
 * Config file path comes from `CONFIG_FILE` environment variable.
 */

import { readFileSync } from 'node:fs';

export interface SpeckitDeveloperAgentConfig {
  /** Agent identifier */
  name: string;
  /** Agent description */
  description: string;
  /** Default Codex model for all spec-kit steps (e.g., "o4-mini", "claude-sonnet-4-5") */
  model?: string;
  /** Depth of related Jira tickets to include in context */
  ticketContextDepth?: number;
  /** Template for feature branch names. Placeholders: {issueKey}, {timestamp} */
  branchNamePattern?: string;
  /** Template for feature artifact directory. Placeholders: {issueKey} */
  featureDirPattern?: string;
  /** Whether to create PRs as drafts initially */
  draftPR?: boolean;
  /** Default prompts for each spec-kit step */
  defaultStepInputs?: {
    specify?: string;
    clarify?: string;
    plan?: string;
    tasks?: string;
    implement?: string;
    code_review?: string;
  };
}

/**
 * Load and parse the agent config file.
 * @param configFilePath - Path to the config JSON file (from CONFIG_FILE env var)
 * @returns Parsed configuration object
 * @throws Error if file doesn't exist or contains invalid JSON
 */
export function loadSpeckitDeveloperAgentConfig(configFilePath: string): SpeckitDeveloperAgentConfig {
  try {
    const content = readFileSync(configFilePath, 'utf8');
    const config = JSON.parse(content) as SpeckitDeveloperAgentConfig;

    // Validate required fields
    if (!config.name) {
      throw new Error('Config must have a "name" field');
    }
    if (!config.description) {
      throw new Error('Config must have a "description" field');
    }

    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Config file not found: ${configFilePath}`);
    }
    throw err;
  }
}

/**
 * Get the effective model to use, with precedence: env var > config > default.
 * @param config - Agent configuration
 * @returns Model name to use
 */
export function getEffectiveModel(config?: SpeckitDeveloperAgentConfig): string {
  // Environment variable takes precedence (backward compatibility)
  const envModel = process.env['DEVELOPER_AGENT_MODEL']?.trim();
  if (envModel) return envModel;

  // Config value
  if (config?.model) return config.model;

  // Default fallback
  return 'o4-mini';
}

/**
 * Get the effective ticket context depth, with precedence: env var > config > default.
 * @param config - Agent configuration
 * @returns Context depth to use
 */
export function getEffectiveTicketContextDepth(config?: SpeckitDeveloperAgentConfig): number {
  // Environment variable takes precedence (backward compatibility)
  const envDepth = process.env['TICKET_CONTEXT_DEPTH']?.trim();
  if (envDepth) {
    const parsed = parseInt(envDepth, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  // Config value
  if (config?.ticketContextDepth !== undefined) return config.ticketContextDepth;

  // Default fallback
  return 1;
}

/**
 * Get the branch name pattern with placeholders.
 * @param config - Agent configuration
 * @returns Branch name pattern
 */
export function getBranchNamePattern(config?: SpeckitDeveloperAgentConfig): string {
  return config?.branchNamePattern ?? 'feature/{issueKey}-{timestamp}';
}

/**
 * Get the feature directory pattern with placeholders.
 * @param config - Agent configuration
 * @returns Feature directory pattern
 */
export function getFeatureDirPattern(config?: SpeckitDeveloperAgentConfig): string {
  return config?.featureDirPattern ?? '.specify/features/{issueKey}';
}

/**
 * Get whether to create PRs as drafts.
 * @param config - Agent configuration
 * @returns true if PRs should be drafts
 */
export function shouldCreateDraftPR(config?: SpeckitDeveloperAgentConfig): boolean {
  return config?.draftPR ?? true;
}

/**
 * Get the default input prompt for a specific step.
 * @param config - Agent configuration
 * @param step - Spec-kit step name
 * @returns Default input prompt or empty string
 */
export function getDefaultStepInput(
  config: SpeckitDeveloperAgentConfig | undefined,
  step: string,
): string {
  if (!config?.defaultStepInputs) return '';

  const inputs = config.defaultStepInputs;
  switch (step) {
    case 'specify':
      return inputs.specify ?? '';
    case 'clarify':
      return inputs.clarify ?? '';
    case 'plan':
      return inputs.plan ?? '';
    case 'tasks':
      return inputs.tasks ?? '';
    case 'implement':
      return inputs.implement ?? '';
    case 'code_review':
      return inputs.code_review ?? '';
    default:
      return '';
  }
}

/**
 * Apply placeholders to a pattern string.
 * @param pattern - Pattern with placeholders
 * @param values - Values to substitute
 * @returns Pattern with placeholders replaced
 */
export function applyPattern(
  pattern: string,
  values: { issueKey?: string; timestamp?: string },
): string {
  let result = pattern;
  if (values.issueKey) {
    result = result.replace(/\{issueKey\}/g, values.issueKey);
  }
  if (values.timestamp) {
    result = result.replace(/\{timestamp\}/g, values.timestamp);
  }
  return result;
}

/**
 * Try to load config from CONFIG_FILE env var. Returns undefined if not set.
 * Throws if CONFIG_FILE is set but the file is invalid.
 */
export function tryLoadConfig(): SpeckitDeveloperAgentConfig | undefined {
  const configFile = process.env['CONFIG_FILE']?.trim();
  if (!configFile) return undefined;

  console.log(`[speckit-developer-agent] Loading config from: ${configFile}`);
  const config = loadSpeckitDeveloperAgentConfig(configFile);
  console.log(`[speckit-developer-agent] Config loaded: ${config.name} - ${config.description}`);
  return config;
}
