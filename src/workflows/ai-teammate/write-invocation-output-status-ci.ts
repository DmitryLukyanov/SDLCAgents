/**
 * CI entry (Business Analyst async child): after Codex, write `invocation-output-status.json`
 * from the primary Codex output + `ba-codex-state.json` ticket context.
 *
 * Env: `CONCURRENCY_KEY` (required), `CONFIG_FILE` (optional, repo-relative — defaults contract layout).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  type AgentInvocationContract,
  DEFAULT_AGENT_INVOCATION_CONTRACT,
  handoffIssueRootAbsolute,
  handoffWorkspacePaths,
  loadAgentInvocationContractFromConfigFile,
  INVOCATION_OUTPUT_STATUS_PARAM_KEY,
  resolvePrimaryOutputKey,
} from '../../lib/agent-invocation-contract.js';
import { interpretBaModelOutput } from '../business-analyst/analyze-ticket.js';
import { STATE_VERSION, type BaCodexStateFile } from './ai-teammate-codex-ba-shared.js';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function loadContract(): AgentInvocationContract {
  const cf = process.env.CONFIG_FILE?.trim();
  if (!cf) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  return loadAgentInvocationContractFromConfigFile(resolve(process.cwd(), cf));
}

function main(): void {
  const issueKey = requireEnv('CONCURRENCY_KEY');
  const cwd = process.cwd();
  const contract = loadContract();
  const statusKey = INVOCATION_OUTPUT_STATUS_PARAM_KEY;
  const statusRef = contract.outputParams[statusKey];
  if (!statusRef) {
    console.log(`[write-invocation-output-status] contract has no outputParams.${statusKey} — nothing to write`);
    return;
  }

  const paths = handoffWorkspacePaths(issueKey, contract);
  if (!existsSync(paths.state)) {
    throw new Error(`[write-invocation-output-status] missing state file: ${paths.state}`);
  }
  const rawState = JSON.parse(readFileSync(paths.state, 'utf8')) as BaCodexStateFile;
  if (rawState.version !== STATE_VERSION) {
    throw new Error(`[write-invocation-output-status] unsupported ba-codex-state.json version: ${String(rawState.version)}`);
  }

  const primaryKey = resolvePrimaryOutputKey(contract);
  const primaryAbs = paths.outputPaths[primaryKey];
  let codexRaw = '';
  if (primaryAbs && existsSync(primaryAbs)) {
    codexRaw = readFileSync(primaryAbs, 'utf8');
  } else {
    console.warn(`[write-invocation-output-status] missing or unreadable primary output at ${String(primaryAbs)} — treating as empty`);
  }

  const outcome = interpretBaModelOutput(codexRaw, rawState.ticketCtx);
  const completed = outcome.status === 'complete';
  const statusAbs = paths.outputPaths[statusKey];
  if (!statusAbs) {
    throw new Error(`[write-invocation-output-status] missing outputPaths.${statusKey}`);
  }

  const payload = {
    completed,
    baStatus: outcome.status,
  };
  mkdirSync(dirname(statusAbs), { recursive: true });
  writeFileSync(statusAbs, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[write-invocation-output-status] wrote ${statusAbs} (${JSON.stringify(payload)})`);

  const root = handoffIssueRootAbsolute(cwd, issueKey);
  console.log(`[write-invocation-output-status] handoff root: ${root}`);
}

main();
