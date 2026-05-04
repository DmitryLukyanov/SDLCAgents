/**
 * CI guard: `invocation-handoff-manifest.json` exists, matches the agent config contract, and every
 * `contract.inputParams` artifact file exists under `async-invocation-handoff/<concurrency_key>/`
 * before the parent uploads the prepare bundle for the async child workflow.
 *
 * Env: CONFIG_FILE, CALLER_CONFIG, AI_TEAMMATE_CONCURRENCY_KEY (same as workflow concurrency_key).
 */
import { resolve } from 'node:path';
import { extractIssueKeyFromCallerConfig, decodeCallerConfig } from '../../lib/caller-config.js';
import { verifyPreparedHandoffBundleAgainstAgentConfig } from '../../lib/invocation-handoff.js';

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

  verifyPreparedHandoffBundleAgainstAgentConfig({
    cwd: process.cwd(),
    handoffIssueKey: concurrencyKey,
    agentConfigPathAbs: resolve(process.cwd(), configFile),
  });
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
