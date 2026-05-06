/**
 * Business Analyst configuration types and loading.
 *
 * Follows the same pattern as speckit-developer-agent-config.ts.
 * Config file path comes from `BA_CONFIG_FILE` environment variable.
 */

import { readFileSync } from 'node:fs';

export interface BusinessAnalystConfig {
  /** Agent identifier */
  name: string;
  /** Agent description */
  description: string;
  /** Agent parameters */
  params?: {
    /** Codex model for BA analysis */
    model?: string;
    [key: string]: unknown;
  };
  /** Legacy: model at root level (backward compatibility) */
  model?: string;
  [key: string]: unknown;
}

/**
 * Load and parse the BA config file.
 * @param configFilePath - Path to the config JSON file
 * @returns Parsed configuration object
 * @throws Error if file doesn't exist or contains invalid JSON
 */
export function loadBusinessAnalystConfig(configFilePath: string): BusinessAnalystConfig {
  try {
    const content = readFileSync(configFilePath, 'utf8');
    const config = JSON.parse(content) as BusinessAnalystConfig;

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
 * Get the effective model to use, with precedence: env var > config.params > config root.
 * Throws an error if no model is configured.
 * @param config - BA configuration
 * @returns Model name to use
 */
export function getEffectiveModel(config?: BusinessAnalystConfig): string {
  // Environment variable takes precedence (backward compatibility)
  const envModel = process.env['BA_CODEX_MODEL']?.trim();
  if (envModel) {
    console.error(`[ba-config] Using BA_CODEX_MODEL from environment: ${envModel}`);
    return envModel;
  }

  // Config params value (new structure)
  if (config?.params?.model) {
    console.error(`[ba-config] Using params.model from config: ${config.params.model}`);
    return config.params.model;
  }

  // Config root value (legacy)
  if (config?.model) {
    console.error(`[ba-config] Using model from config root: ${config.model}`);
    return config.model;
  }

  // No default - require explicit configuration
  throw new Error(
    'BA model must be configured. Set params.model in your business-analyst.config file or provide BA_CODEX_MODEL environment variable.'
  );
}

/**
 * Try to load config from BA_CONFIG_FILE env var. Returns undefined if not set.
 * Throws if BA_CONFIG_FILE is set but the file is invalid.
 */
export function tryLoadConfig(): BusinessAnalystConfig | undefined {
  const configFile = process.env['BA_CONFIG_FILE']?.trim();
  if (!configFile) return undefined;

  console.log(`[business-analyst] Loading config from: ${configFile}`);
  const config = loadBusinessAnalystConfig(configFile);
  console.log(`[business-analyst] Config loaded: ${config.name} - ${config.description}`);
  return config;
}
