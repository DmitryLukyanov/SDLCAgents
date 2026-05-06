#!/usr/bin/env tsx
/**
 * Extract BA model from AI Teammate config file.
 * Used by business-analyst.yml to read baModel from config instead of repository variable.
 *
 * Environment:
 *   CONFIG_FILE — path to agent config JSON
 *
 * Output:
 *   Prints the model name to stdout (for use with GitHub Actions output)
 *   Exits with error if model is not configured
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface AiTeammateConfig {
  name: string;
  params?: {
    baModel?: string;
    [key: string]: unknown;
  };
  // Legacy: baModel at root level (backward compatibility)
  baModel?: string;
  [key: string]: unknown;
}

function getEffectiveBaModel(config: AiTeammateConfig): string {
  // Environment variable takes precedence (backward compatibility)
  const envModel = process.env['BA_CODEX_MODEL']?.trim();
  if (envModel) {
    console.error(`[ba-model] Using BA_CODEX_MODEL from environment: ${envModel}`);
    return envModel;
  }

  // Config params value (new structure)
  if (config?.params?.baModel) {
    console.error(`[ba-model] Using params.baModel from config: ${config.params.baModel}`);
    return config.params.baModel;
  }

  // Config root value (legacy)
  if (config?.baModel) {
    console.error(`[ba-model] Using baModel from config root: ${config.baModel}`);
    return config.baModel;
  }

  // No default - require explicit configuration
  throw new Error(
    'BA model must be configured. Set params.baModel in your AI Teammate config file or provide BA_CODEX_MODEL environment variable.'
  );
}

function main(): void {
  const configFile = process.env['CONFIG_FILE']?.trim();
  if (!configFile) {
    throw new Error('CONFIG_FILE environment variable is required');
  }

  const configPath = resolve(process.cwd(), configFile);
  console.error(`[ba-model] Loading config from: ${configPath}`);

  const content = readFileSync(configPath, 'utf8');
  const config = JSON.parse(content) as AiTeammateConfig;

  const model = getEffectiveBaModel(config);

  // Output to stdout for GitHub Actions to capture
  console.log(model);
}

main();
