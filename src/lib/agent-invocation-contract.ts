/**
 * Generic async invocation contract: **artifact-only** handoff on the runner.
 *
 * Files live under {@link ASYNC_INVOCATION_HANDOFF_ROOT_DIR}/`<issueKey>`/ before the parent uploads the
 * **prepare** artifact. After restore on the parent resume job (prepare + post-Codex artifacts), the same
 * relative paths are used — `codexRelativeOutputPath` in state points at the primary output file inside that tree.
 *
 * **Cross-workflow communication** for the async child must use files under that tree plus
 * {@link INVOCATION_HANDOFF_MANIFEST_FILENAME} (written at prepare time). Do not pass duplicate path strings on
 * `workflow_dispatch` for Codex inputs/outputs — read the manifest in the consumer workflow instead.
 *
 * For **composed** validation (manifest vs config, resume checks), use {@link ./invocation-handoff.js}.
 *
 * `inputParams` / `outputParams` are **open maps** of logical names → {@link ArtifactHandoffRef}. Defaults match
 * the Codex BA profile (`prompt`, `jiraContext`, `resultState`). Optional `primaryOutputKey` picks which output
 * entry becomes `codexRelativeOutputPath` when more than one output exists.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findFirstEnabledAsyncCallStepIndex,
  parseAgentPipelineSteps,
  type AgentJsonWithPipeline,
  type PipelineStepConfig,
} from './pipeline-config.js';

/** Repo-relative directory for async parent/child handoff (not `spec-output`; speckit-developer-agent may still use that). */
export const ASYNC_INVOCATION_HANDOFF_ROOT_DIR = 'async-invocation-handoff' as const;

/**
 * Written into the prepare-bundle artifact: **single source of truth** for which relative paths Codex uses.
 * Child workflows must resolve `prompt_file` / `output_file` from this file (not duplicate path strings on dispatch).
 */
export const INVOCATION_HANDOFF_MANIFEST_FILENAME = 'invocation-handoff-manifest.json' as const;

export const INVOCATION_HANDOFF_MANIFEST_VERSION = 1 as const;

export interface InvocationHandoffManifestV1 {
  version: typeof INVOCATION_HANDOFF_MANIFEST_VERSION;
  /** Full contract snapshot (must match the async step in the parent agent config at prepare time). */
  contract: AgentInvocationContract;
  /** Relative paths under the issue handoff directory — derived from `contract` only. */
  dispatchPathHints: {
    invocation_prompt_file: string;
    invocation_jira_context_file: string;
    invocation_output_file: string;
  };
}

/** Absolute path `async-invocation-handoff/<issueKey>/` under `cwd` (typically `process.cwd()`). */
export function handoffIssueRootAbsolute(cwd: string, issueKey: string): string {
  return join(cwd, ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey);
}

/** File inside `${ASYNC_INVOCATION_HANDOFF_ROOT_DIR}/<issueKey>/` included in the prepare-bundle artifact. */
export type ArtifactHandoffRef = {
  kind: 'artifact';
  scope: 'handoff_workspace';
  relativePath: string;
};

/** Logical name → artifact ref (e.g. `prompt`, `jiraContext`, or agent-specific keys). */
export type InvocationArtifactParamMap = Readonly<Record<string, ArtifactHandoffRef>>;

export interface AgentInvocationContract {
  /**
   * Which `outputParams` entry is the primary model/tool result path stored in `ba-codex-state.json`.
   * If omitted: use `resultState` when present, else the sole output key, else an error when ambiguous.
   */
  primaryOutputKey?: string;
  inputParams: InvocationArtifactParamMap;
  outputParams: InvocationArtifactParamMap;
}

/** Codex BA prepare (`ai-teammate-codex-ba-prepare.ts`) only materializes these input keys today. */
export const BA_CODEX_PREPARE_INPUT_KEYS = ['prompt', 'jiraContext'] as const;
export type BaCodexPrepareInputKey = (typeof BA_CODEX_PREPARE_INPUT_KEYS)[number];

/**
 * Maps contract `inputParams` keys → `workflow_dispatch` input names on `business-analyst.yml`.
 * Extend this map when the consumer workflow gains matching string inputs.
 */
export const BA_CODEX_WORKFLOW_DISPATCH_INPUT_KEYS: Readonly<Record<BaCodexPrepareInputKey, string>> = {
  prompt: 'invocation_prompt_file',
  jiraContext: 'invocation_jira_context_file',
} as const;

export const BA_CODEX_WORKFLOW_DISPATCH_OUTPUT_KEY = 'invocation_output_file' as const;

/** Agent-agnostic default filenames (under `${ASYNC_INVOCATION_HANDOFF_ROOT_DIR}/<issueKey>/`). */
export const DEFAULT_AGENT_INVOCATION_CONTRACT: AgentInvocationContract = {
  inputParams: {
    prompt: { kind: 'artifact', scope: 'handoff_workspace', relativePath: 'invocation-prompt.md' },
    jiraContext: { kind: 'artifact', scope: 'handoff_workspace', relativePath: 'invocation-jira-context.md' },
  },
  outputParams: {
    resultState: { kind: 'artifact', scope: 'handoff_workspace', relativePath: 'invocation-output.txt' },
  },
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

const RESERVED_CONTRACT_ROOT_KEYS = new Set(['inputParams', 'outputParams', 'primaryOutputKey']);

export function parseArtifactHandoffRef(raw: unknown, field: string): ArtifactHandoffRef {
  if (!isRecord(raw)) throw new Error(`invocation contract: ${field} must be an object`);
  if (raw.kind !== 'artifact') throw new Error(`invocation contract: ${field}.kind must be "artifact"`);
  if (raw.scope !== 'handoff_workspace') {
    throw new Error(`invocation contract: ${field}.scope must be "handoff_workspace" (only scope supported today)`);
  }
  const rel = typeof raw.relativePath === 'string' ? raw.relativePath.trim() : '';
  if (!rel || rel.includes('..')) {
    throw new Error(`invocation contract: ${field}.relativePath must be a non-empty safe relative path`);
  }
  return { kind: 'artifact', scope: 'handoff_workspace', relativePath: rel };
}

function parseArtifactInput(raw: unknown, field: string): ArtifactHandoffRef {
  if (isRecord(raw) && raw.kind === 'github_issue') {
    throw new Error(
      `invocation contract: ${field} — kind "github_issue" is removed; only artifacts are supported. ` +
        'Use { "kind": "artifact", "scope": "handoff_workspace", "relativePath": "<file>" } ' +
        `and materialize that file under ${ASYNC_INVOCATION_HANDOFF_ROOT_DIR}/<issueKey>/ before uploading the handoff bundle.`,
    );
  }
  return parseArtifactHandoffRef(raw, field);
}

function shallowCloneArtifactMap(map: InvocationArtifactParamMap): Record<string, ArtifactHandoffRef> {
  return { ...map };
}

function cloneAgentInvocationContract(c: AgentInvocationContract): AgentInvocationContract {
  return {
    ...(c.primaryOutputKey !== undefined ? { primaryOutputKey: c.primaryOutputKey } : {}),
    inputParams: { ...c.inputParams } as InvocationArtifactParamMap,
    outputParams: { ...c.outputParams } as InvocationArtifactParamMap,
  };
}

/**
 * Parse a contract object (named contract entry or inline `step.contract` body).
 * Missing param keys merge with {@link DEFAULT_AGENT_INVOCATION_CONTRACT}.
 */
export function parseInvocationContractObject(raw: unknown, fieldLabel: string): AgentInvocationContract {
  if (!raw) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  if (!isRecord(raw)) throw new Error(`invocation contract: ${fieldLabel} must be an object`);

  const inP = raw.inputParams;
  const outP = raw.outputParams;
  if (inP !== undefined && !isRecord(inP)) {
    throw new Error(`invocation contract: ${fieldLabel}.inputParams must be an object`);
  }
  if (outP !== undefined && !isRecord(outP)) {
    throw new Error(`invocation contract: ${fieldLabel}.outputParams must be an object`);
  }

  const def = DEFAULT_AGENT_INVOCATION_CONTRACT;
  const inputParams = shallowCloneArtifactMap(def.inputParams);
  if (inP) {
    for (const [k, v] of Object.entries(inP)) {
      inputParams[k] = parseArtifactInput(v, `${fieldLabel}.inputParams.${k}`);
    }
  }

  const outputParams: Record<string, ArtifactHandoffRef> = outP
    ? Object.fromEntries(
        Object.entries(outP).map(([k, v]) => [k, parseArtifactHandoffRef(v, `${fieldLabel}.outputParams.${k}`)]),
      )
    : shallowCloneArtifactMap(def.outputParams);
  if (Object.keys(outputParams).length === 0) {
    throw new Error(`invocation contract: ${fieldLabel} outputParams must declare at least one artifact`);
  }

  let primaryOutputKey: string | undefined;
  if (raw.primaryOutputKey !== undefined) {
    if (typeof raw.primaryOutputKey !== 'string' || !raw.primaryOutputKey.trim()) {
      throw new Error(`invocation contract: ${fieldLabel} primaryOutputKey must be a non-empty string when set`);
    }
    primaryOutputKey = raw.primaryOutputKey.trim();
    if (!outputParams[primaryOutputKey]) {
      throw new Error(
        `invocation contract: ${fieldLabel} primaryOutputKey "${primaryOutputKey}" is not present in outputParams`,
      );
    }
  }

  for (const k of Object.keys(raw)) {
    if (!RESERVED_CONTRACT_ROOT_KEYS.has(k)) {
      throw new Error(
        `invocation contract: unknown property "${k}" on ${fieldLabel} (allowed: inputParams, outputParams, primaryOutputKey)`,
      );
    }
  }

  return {
    ...(primaryOutputKey !== undefined ? { primaryOutputKey } : {}),
    inputParams,
    outputParams,
  };
}

/** Load `config.contracts` map (FR-004). Empty object when absent. */
export function loadNamedContractsFromConfigRoot(
  root: AgentJsonWithPipeline,
  configLabel: string,
): Record<string, AgentInvocationContract> {
  const raw = (root as { contracts?: unknown }).contracts;
  if (raw === undefined) return {};
  if (!isRecord(raw)) throw new Error(`${configLabel}: contracts must be an object`);
  const out: Record<string, AgentInvocationContract> = {};
  for (const [name, entry] of Object.entries(raw)) {
    const key = name.trim();
    if (!key) throw new Error(`${configLabel}: contracts contains an empty key`);
    out[key] = parseInvocationContractObject(entry, `contracts["${key}"]`);
  }
  return out;
}

function mergeContractOverride(
  base: AgentInvocationContract,
  overrideRaw: Record<string, unknown>,
  stepLabel: string,
): AgentInvocationContract {
  const merged = cloneAgentInvocationContract(base);
  const inMap = merged.inputParams as Record<string, ArtifactHandoffRef>;
  const outMap = merged.outputParams as Record<string, ArtifactHandoffRef>;
  const inP = overrideRaw.inputParams;
  const outP = overrideRaw.outputParams;
  if (inP !== undefined) {
    if (!isRecord(inP)) throw new Error(`invocation contract: ${stepLabel} contract override inputParams must be an object`);
    for (const [k, v] of Object.entries(inP)) {
      const parsed = parseArtifactInput(v, `override.inputParams.${k}`);
      const prev = inMap[k];
      if (prev && prev.relativePath !== parsed.relativePath) {
        throw new Error(
          `contract override conflict: ${stepLabel} redefines inputParams.${k} with a different path ` +
            `("${prev.relativePath}" vs "${parsed.relativePath}") (FR-018)`,
        );
      }
      inMap[k] = parsed;
    }
  }
  if (outP !== undefined) {
    if (!isRecord(outP)) {
      throw new Error(`invocation contract: ${stepLabel} contract override outputParams must be an object`);
    }
    for (const [k, v] of Object.entries(outP)) {
      const parsed = parseArtifactHandoffRef(v, `override.outputParams.${k}`);
      const prev = outMap[k];
      if (prev && prev.relativePath !== parsed.relativePath) {
        throw new Error(
          `contract override conflict: ${stepLabel} redefines outputParams.${k} with a different path ` +
            `("${prev.relativePath}" vs "${parsed.relativePath}") (FR-018)`,
        );
      }
      outMap[k] = parsed;
    }
  }
  if (overrideRaw.primaryOutputKey !== undefined) {
    const pk =
      typeof overrideRaw.primaryOutputKey === 'string' ? overrideRaw.primaryOutputKey.trim() : '';
    if (!pk) throw new Error(`invocation contract: ${stepLabel} override primaryOutputKey invalid`);
    const effective = resolvePrimaryOutputKey(merged);
    if (pk !== effective) {
      throw new Error(
        `contract override conflict: ${stepLabel} primaryOutputKey "${pk}" does not match merged output map ` +
          `(resolves to "${effective}") (FR-018)`,
      );
    }
    merged.primaryOutputKey = pk;
  }
  for (const k of Object.keys(overrideRaw)) {
    if (!RESERVED_CONTRACT_ROOT_KEYS.has(k)) {
      throw new Error(`invocation contract: unknown override property "${k}" on ${stepLabel}`);
    }
  }
  return merged;
}

/**
 * Parse effective invocation contract for a step: optional `contractRef` (named `config.contracts`),
 * optional inline `contract` overrides (FR-017, FR-018).
 */
export function parseAgentInvocationContractFromStep(
  step: PipelineStepConfig,
  namedContracts?: Record<string, AgentInvocationContract>,
): AgentInvocationContract {
  const rawStep = step as { contractRef?: unknown; contract?: unknown };
  const ref = typeof rawStep.contractRef === 'string' ? rawStep.contractRef.trim() : '';
  const rawContract = rawStep.contract;

  if (ref) {
    if (!namedContracts || !namedContracts[ref]) {
      throw new Error(
        `invocation contract: contractRef "${ref}" not found in config.contracts (FR-017)`,
      );
    }
    let base = cloneAgentInvocationContract(namedContracts[ref]!);
    if (rawContract !== undefined && rawContract !== null) {
      if (!isRecord(rawContract)) throw new Error('invocation contract: step.contract must be an object');
      base = mergeContractOverride(base, rawContract, `step "${step.id ?? step.runner}"`);
    }
    return base;
  }

  if (!rawContract) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  return parseInvocationContractObject(rawContract, `step "${step.id ?? step.runner}" contract`);
}

/** Which output param supplies `codexRelativeOutputPath` / Codex `output-file`. */
export function resolvePrimaryOutputKey(contract: AgentInvocationContract): string {
  if (contract.primaryOutputKey) return contract.primaryOutputKey;
  const keys = Object.keys(contract.outputParams);
  if (keys.includes('resultState')) return 'resultState';
  if (keys.length === 1) return keys[0]!;
  if (keys.length === 0) {
    throw new Error('invocation contract: outputParams must declare at least one artifact');
  }
  throw new Error(
    `invocation contract: ambiguous outputParams (${keys.join(', ')}) — set contract.primaryOutputKey`,
  );
}

export function loadAgentInvocationContractFromConfigText(raw: string, configLabel: string): AgentInvocationContract {
  let root: AgentJsonWithPipeline;
  try {
    root = JSON.parse(raw) as AgentJsonWithPipeline;
  } catch (e) {
    throw new Error(`${configLabel}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const named = loadNamedContractsFromConfigRoot(root, configLabel);
  const steps = parseAgentPipelineSteps(raw, configLabel);
  const idx = findFirstEnabledAsyncCallStepIndex(steps);
  if (idx < 0) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  return parseAgentInvocationContractFromStep(steps[idx]!, named);
}

export function loadAgentInvocationContractFromConfigFile(configPathAbs: string): AgentInvocationContract {
  const raw = readFileSync(configPathAbs, 'utf8');
  return loadAgentInvocationContractFromConfigText(raw, configPathAbs);
}

/**
 * Hints for the current **Codex BA** consumer workflow (`business-analyst.yml`): fixed `workflow_dispatch` inputs.
 * Contract must declare every {@link BA_CODEX_WORKFLOW_DISPATCH_INPUT_KEYS} entry under `inputParams`.
 */
export function buildInvocationDispatchHints(contract: AgentInvocationContract): {
  invocation_prompt_file: string;
  invocation_jira_context_file: string;
  invocation_output_file: string;
} {
  const primaryOut = resolvePrimaryOutputKey(contract);
  const outRef = contract.outputParams[primaryOut];
  if (!outRef) {
    throw new Error(`[buildInvocationDispatchHints] missing outputParams.${primaryOut}`);
  }
  const result: Record<string, string> = {
    [BA_CODEX_WORKFLOW_DISPATCH_OUTPUT_KEY]: outRef.relativePath,
  };
  for (const logical of Object.keys(BA_CODEX_WORKFLOW_DISPATCH_INPUT_KEYS) as BaCodexPrepareInputKey[]) {
    const workflowKey = BA_CODEX_WORKFLOW_DISPATCH_INPUT_KEYS[logical];
    const ref = contract.inputParams[logical];
    if (!ref) {
      throw new Error(
        `[buildInvocationDispatchHints] Codex BA dispatch requires contract.inputParams.${logical} (artifact ref)`,
      );
    }
    result[workflowKey] = ref.relativePath;
  }
  return result as {
    invocation_prompt_file: string;
    invocation_jira_context_file: string;
    invocation_output_file: string;
  };
}

export function buildInvocationHandoffManifest(contract: AgentInvocationContract): InvocationHandoffManifestV1 {
  const dispatchPathHints = buildInvocationDispatchHints(contract);
  return {
    version: INVOCATION_HANDOFF_MANIFEST_VERSION,
    contract,
    dispatchPathHints,
  };
}

export function writeInvocationHandoffManifestFile(
  handoffIssueRootAbs: string,
  contract: AgentInvocationContract,
): void {
  const manifest = buildInvocationHandoffManifest(contract);
  const dest = join(handoffIssueRootAbs, INVOCATION_HANDOFF_MANIFEST_FILENAME);
  writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function readInvocationHandoffManifestFile(handoffIssueRootAbs: string): InvocationHandoffManifestV1 {
  const p = join(handoffIssueRootAbs, INVOCATION_HANDOFF_MANIFEST_FILENAME);
  if (!existsSync(p)) {
    throw new Error(`Missing invocation handoff manifest: ${p}`);
  }
  const raw = JSON.parse(readFileSync(p, 'utf8')) as InvocationHandoffManifestV1;
  if (raw.version !== INVOCATION_HANDOFF_MANIFEST_VERSION) {
    throw new Error(`Unsupported ${INVOCATION_HANDOFF_MANIFEST_FILENAME} version: ${String(raw?.version)}`);
  }
  if (!raw.contract || typeof raw.contract !== 'object') {
    throw new Error(`Invalid ${INVOCATION_HANDOFF_MANIFEST_FILENAME}: missing contract`);
  }
  const h = raw.dispatchPathHints;
  if (!h || typeof h !== 'object') {
    throw new Error(`Invalid ${INVOCATION_HANDOFF_MANIFEST_FILENAME}: missing dispatchPathHints`);
  }
  for (const k of ['invocation_prompt_file', 'invocation_jira_context_file', 'invocation_output_file'] as const) {
    if (typeof h[k] !== 'string' || !h[k].trim()) {
      throw new Error(`Invalid ${INVOCATION_HANDOFF_MANIFEST_FILENAME}: dispatchPathHints.${k}`);
    }
  }
  return raw;
}

/** True when both contracts refer to the same artifact relative paths (and primary output key). */
export function invocationContractsArtifactPathsEqual(a: AgentInvocationContract, b: AgentInvocationContract): boolean {
  const inKeys = new Set([...Object.keys(a.inputParams), ...Object.keys(b.inputParams)]);
  for (const k of inKeys) {
    if (a.inputParams[k]?.relativePath !== b.inputParams[k]?.relativePath) return false;
  }
  const outKeys = new Set([...Object.keys(a.outputParams), ...Object.keys(b.outputParams)]);
  for (const k of outKeys) {
    if (a.outputParams[k]?.relativePath !== b.outputParams[k]?.relativePath) return false;
  }
  return (
    resolvePrimaryOutputKey(a) === resolvePrimaryOutputKey(b) &&
    (a.primaryOutputKey ?? '') === (b.primaryOutputKey ?? '')
  );
}

export type HandoffWorkspacePaths = {
  base: string;
  /** Absolute paths for each `contract.inputParams` key. */
  inputPaths: Record<string, string>;
  /** Absolute paths for each `contract.outputParams` key (Codex typically writes only the primary). */
  outputPaths: Record<string, string>;
  state: string;
  githubIssuePrep: string;
  primaryOutputKey: string;
  codexRelativeOutputPath: string;
};

/** Absolute paths under `process.cwd()` for the handoff workspace. Internal checkpoints are fixed names. */
export function handoffWorkspacePaths(issueKey: string, contract: AgentInvocationContract): HandoffWorkspacePaths {
  const base = join(process.cwd(), ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey);
  const primaryOutputKey = resolvePrimaryOutputKey(contract);
  const outLink = contract.outputParams[primaryOutputKey];
  if (!outLink) {
    throw new Error(`[handoffWorkspacePaths] contract.outputParams.${primaryOutputKey} is missing`);
  }

  const inputPaths: Record<string, string> = {};
  for (const [k, ref] of Object.entries(contract.inputParams)) {
    inputPaths[k] = join(base, ref.relativePath);
  }
  const outputPaths: Record<string, string> = {};
  for (const [k, ref] of Object.entries(contract.outputParams)) {
    outputPaths[k] = join(base, ref.relativePath);
  }

  return {
    base,
    inputPaths,
    outputPaths,
    state: join(base, 'ba-codex-state.json'),
    githubIssuePrep: join(base, 'ba-github-issue-prep.json'),
    primaryOutputKey,
    codexRelativeOutputPath: join(ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey, outLink.relativePath).replace(
      /\\/g,
      '/',
    ),
  };
}

/**
 * After the async child run, the parent job restores the handoff tree; the primary `contract.outputParams`
 * file must exist before runner-specific resume logic runs.
 */
export function assertAsyncHandoffPrimaryOutputPresent(issueKey: string, contract: AgentInvocationContract): void {
  const p = handoffWorkspacePaths(issueKey, contract);
  const primaryKey = resolvePrimaryOutputKey(contract);
  const abs = p.outputPaths[primaryKey];
  if (!abs) {
    throw new Error(`[assertAsyncHandoffPrimaryOutputPresent] missing outputPaths.${primaryKey}`);
  }
  if (!existsSync(abs)) {
    throw new Error(
      `[assertAsyncHandoffPrimaryOutputPresent] expected primary async output artifact at ${abs} ` +
        `(contract.outputParams.${primaryKey}.relativePath). Ensure the child workflow produced it and ` +
        'the parent job downloaded the post-async artifact bundle.',
    );
  }
  for (const [k, path] of Object.entries(p.outputPaths)) {
    if (k === primaryKey) continue;
    if (!existsSync(path)) {
      console.warn(
        `[assertAsyncHandoffPrimaryOutputPresent] non-primary output "${k}" missing at ${path} (ignored)`,
      );
    }
  }
}

export function assertBaCodexPrepareContract(contract: AgentInvocationContract): void {
  for (const k of BA_CODEX_PREPARE_INPUT_KEYS) {
    if (!contract.inputParams[k]) {
      throw new Error(`[codex-ba-prepare] contract.inputParams.${k} is required for Codex BA prepare`);
    }
  }
  const unknownInputs = Object.keys(contract.inputParams).filter(
    k => !(BA_CODEX_PREPARE_INPUT_KEYS as readonly string[]).includes(k),
  );
  if (unknownInputs.length > 0) {
    throw new Error(
      `[codex-ba-prepare] unsupported contract.inputParams keys: ${unknownInputs.join(', ')} — ` +
        `extend ai-teammate-codex-ba-prepare or remove them (supported: ${BA_CODEX_PREPARE_INPUT_KEYS.join(', ')})`,
    );
  }
}
