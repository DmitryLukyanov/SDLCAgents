/**
 * SpecKit Developer Agent configuration types and loading.
 *
 * Mirrors the pattern used by AI Teammate (ai-teammate-agent.ts + pipeline config).
 * Config file path comes from `CONFIG_FILE` environment variable.
 */

import { readFileSync } from 'node:fs';
import type { PipelineStepConfig } from '../../lib/pipeline-config.js';

export interface SpeckitDeveloperAgentConfig {
  /** Agent identifier */
  name: string;
  /** Agent description */
  description: string;
  /** Pipeline parameters (when using pipeline mode) */
  params?: {
    /** Runner type - "pipeline" for pipeline mode */
    runner?: string;
    /** Default Codex model for all spec-kit steps */
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
    /** Pipeline steps (for pipeline mode) */
    steps?: PipelineStepConfig[];
    [key: string]: unknown;
  };
  /** Legacy: model at root level (backward compatibility) */
  model?: string;
  /** Legacy: ticketContextDepth at root level (backward compatibility) */
  ticketContextDepth?: number;
  /** Legacy: branchNamePattern at root level (backward compatibility) */
  branchNamePattern?: string;
  /** Legacy: featureDirPattern at root level (backward compatibility) */
  featureDirPattern?: string;
  /** Legacy: draftPR at root level (backward compatibility) */
  draftPR?: boolean;
  /** Legacy: defaultStepInputs at root level (backward compatibility) */
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
 * Get the effective model to use, with precedence: env var > config.params > config root > default.
 * @param config - Agent configuration
 * @returns Model name to use
 */
export function getEffectiveModel(config?: SpeckitDeveloperAgentConfig): string {
  // Environment variable takes precedence (backward compatibility)
  const envModel = process.env['DEVELOPER_AGENT_MODEL']?.trim();
  if (envModel) return envModel;

  // Config params value (new structure)
  if (config?.params?.model) return config.params.model;

  // Config root value (legacy)
  if (config?.model) return config.model;

  // Default fallback
  return 'o4-mini';
}

/**
 * Get the effective ticket context depth, with precedence: env var > config.params > config root > default.
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

  // Config params value (new structure) — validate it is a finite integer >= 0
  if (config?.params?.ticketContextDepth !== undefined) {
    const v = config.params.ticketContextDepth;
    if (Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  }

  // Config root value (legacy) — same validation
  if (config?.ticketContextDepth !== undefined) {
    const v = config.ticketContextDepth;
    if (Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  }

  // Default fallback
  return 1;
}

/**
 * Get the branch name pattern with placeholders.
 * @param config - Agent configuration
 * @returns Branch name pattern
 */
export function getBranchNamePattern(config?: SpeckitDeveloperAgentConfig): string {
  return config?.params?.branchNamePattern ?? config?.branchNamePattern ?? 'feature/{issueKey}-{timestamp}';
}

/**
 * Get the feature directory pattern with placeholders.
 * @param config - Agent configuration
 * @returns Feature directory pattern
 */
export function getFeatureDirPattern(config?: SpeckitDeveloperAgentConfig): string {
  return config?.params?.featureDirPattern ?? config?.featureDirPattern ?? '.specify/features/{issueKey}';
}

/**
 * Get whether to create PRs as drafts.
 * @param config - Agent configuration
 * @returns true if PRs should be drafts
 */
export function shouldCreateDraftPR(config?: SpeckitDeveloperAgentConfig): boolean {
  return config?.params?.draftPR ?? config?.draftPR ?? true;
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
  if (!config) return '';

  // Try params.defaultStepInputs first (new structure), then root defaultStepInputs (legacy)
  const inputs = config.params?.defaultStepInputs ?? config.defaultStepInputs;
  if (!inputs) return '';

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
