#!/usr/bin/env tsx
/**
 * Extract BA model from Business Analyst config file.
 * Used by business-analyst.yml to read model from BA-specific config.
 *
 * Environment:
 *   BA_CONFIG_FILE — path to business-analyst.config JSON
 *
 * Output:
 *   Prints the model name to stdout (for use with GitHub Actions output)
 *   Exits with error if model is not configured
 */

import { resolve } from 'node:path';
import { loadBusinessAnalystConfig, getEffectiveModel } from './business-analyst-config.js';

function main(): void {
  const configFile = process.env['BA_CONFIG_FILE']?.trim();
  if (!configFile) {
    throw new Error('BA_CONFIG_FILE environment variable is required');
  }

  const configPath = resolve(process.cwd(), configFile);
  console.error(`[ba-model] Loading config from: ${configPath}`);

  const config = loadBusinessAnalystConfig(configPath);
  const model = getEffectiveModel(config);

  // Output to stdout for GitHub Actions to capture
  console.log(model);
}

main();
