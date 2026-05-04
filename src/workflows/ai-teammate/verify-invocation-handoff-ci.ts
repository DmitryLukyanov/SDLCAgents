/**
 * CI guard: every `contract.inputParams` artifact file exists under `async-invocation-handoff/<concurrency_key>/`
 * before the parent uploads the prepare bundle for the async child workflow.
 *
 * Env: CONFIG_FILE, CALLER_CONFIG, AI_TEAMMATE_CONCURRENCY_KEY (same as workflow concurrency_key).
 */
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractIssueKeyFromCallerConfig, decodeCallerConfig } from '../../lib/caller-config.js';
import {
  handoffWorkspacePaths,
  loadAgentInvocationContractFromConfigFile,
} from '../../lib/agent-invocation-contract.js';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function main(): void {
  const configFile = requireEnv('CONFIG_FILE');
  const caller = requireEnv('CALLER_CONFIG');
  const concurrencyKey = requireEnv('AI_TEAMMATE_CONCURRENCY_KEY');
  const issueKey = extractIssueKeyFromCallerConfig(decodeCallerConfig(caller));
  if (issueKey !== concurrencyKey) {
    console.warn(
      `[verify-invocation-handoff] concurrency_key "${concurrencyKey}" differs from CALLER_CONFIG issue "${issueKey}" — using concurrency_key for async handoff path (workflow convention).`,
    );
  }

  const configAbs = resolve(process.cwd(), configFile);
  const contract = loadAgentInvocationContractFromConfigFile(configAbs);
  const p = handoffWorkspacePaths(concurrencyKey, contract);

  const checks: { label: string; path: string }[] = Object.keys(contract.inputParams).map(key => ({
    label: `inputParams.${key}`,
    path: p.inputPaths[key]!,
  }));
  for (const { label, path } of checks) {
    if (!existsSync(path)) {
      throw new Error(`[verify-invocation-handoff] Missing ${label} artifact file: ${path}`);
    }
    if (statSync(path).size === 0) {
      throw new Error(`[verify-invocation-handoff] Empty ${label} artifact file: ${path}`);
    }
  }
  console.log(`[verify-invocation-handoff] OK — ${checks.map(c => c.path).join(', ')}`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
