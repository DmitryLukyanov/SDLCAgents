/**
 * **Composed** async invocation handoff logic — manifest + contract equality + filesystem checks.
 *
 * Primitives (parse, path math, manifest read/write) live in {@link ./agent-invocation-contract.js}.
 * Import **this** module from any workflow/CI entrypoint so handoff rules stay consistent (AI Teammate,
 * future agents, or other repos that copy the same artifact layout).
 */
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertAsyncHandoffPrimaryOutputPresent,
  handoffIssueRootAbsolute,
  invocationContractsArtifactPathsEqual,
  loadAgentInvocationContractFromConfigFile,
  parseAgentInvocationContractFromStep,
  readInvocationHandoffManifestFile,
  type AgentInvocationContract,
} from './agent-invocation-contract.js';
import type { PipelineStepConfig } from './pipeline-config.js';

export interface VerifyPreparedHandoffBundleParams {
  /** Repository root (usually `process.cwd()`). */
  cwd: string;
  /** Handoff subdirectory name under `async-invocation-handoff/` (workflow `concurrency_key`, typically the Jira key). */
  handoffIssueKey: string;
  /** Absolute path to the agent JSON file whose first enabled async step defines the expected contract. */
  agentConfigPathAbs: string;
  /** Log line / error prefix (default: `[verify-invocation-handoff]`). */
  logPrefix?: string;
}

/**
 * After prepare: manifest must match the on-disk agent config, and every `contract.inputParams` file must
 * exist and be non-empty under the handoff root. Use from parent CI before uploading the prepare artifact.
 */
export function verifyPreparedHandoffBundleAgainstAgentConfig(p: VerifyPreparedHandoffBundleParams): void {
  const prefix = p.logPrefix ?? '[verify-invocation-handoff]';
  const configContract = loadAgentInvocationContractFromConfigFile(p.agentConfigPathAbs);
  const handoffRoot = handoffIssueRootAbsolute(p.cwd, p.handoffIssueKey);
  const manifest = readInvocationHandoffManifestFile(handoffRoot);
  if (!invocationContractsArtifactPathsEqual(manifest.contract, configContract)) {
    throw new Error(
      `${prefix} ${handoffRoot} manifest contract does not match agent config (${p.agentConfigPathAbs}). ` +
        'Regenerate the handoff bundle from the same config (artifact-only contract must stay in sync).',
    );
  }

  const checks: { label: string; path: string }[] = Object.keys(manifest.contract.inputParams).map(key => ({
    label: `inputParams.${key}`,
    path: resolve(handoffRoot, manifest.contract.inputParams[key]!.relativePath),
  }));
  for (const { label, path } of checks) {
    if (!existsSync(path)) {
      throw new Error(`${prefix} Missing ${label} artifact file: ${path}`);
    }
    if (statSync(path).size === 0) {
      throw new Error(`${prefix} Empty ${label} artifact file: ${path}`);
    }
  }
  console.log(`${prefix} OK — manifest + ${checks.map(c => c.path).join(', ')}`);
}

export interface AssertAsyncResumeHandoffParams {
  cwd: string;
  issueKey: string;
  triggerStep: PipelineStepConfig;
  /** Short label prepended to thrown errors (e.g. `Pipeline async resume`). */
  contextLabel: string;
}

/**
 * Parent resume after async child: artifact manifest must match the pipeline async step’s `contract`, and
 * the primary `outputParams` file must exist on disk (child artifact restored). Returns the effective contract
 * from the manifest for further use.
 */
export function assertManifestMatchesAsyncStepAndPrimaryOutputPresent(
  p: AssertAsyncResumeHandoffParams,
): AgentInvocationContract {
  const manifest = readInvocationHandoffManifestFile(handoffIssueRootAbsolute(p.cwd, p.issueKey));
  const stepContract = parseAgentInvocationContractFromStep(p.triggerStep);
  if (!invocationContractsArtifactPathsEqual(manifest.contract, stepContract)) {
    throw new Error(
      `${p.contextLabel}: invocation-handoff-manifest.json contract does not match the agent config ` +
        `async step "${String(p.triggerStep.id)}". Refresh the handoff bundle from the same config or fix config drift.`,
    );
  }
  assertAsyncHandoffPrimaryOutputPresent(p.issueKey, manifest.contract);
  return manifest.contract;
}
