/**
 * Generic async invocation contract: **artifact-only** handoff on the runner.
 *
 * Files live under {@link ASYNC_INVOCATION_HANDOFF_ROOT_DIR}/`<issueKey>`/ before the parent uploads the
 * **prepare** artifact. After restore on the parent resume job (prepare + post-Codex artifacts), the same
 * relative paths are used — `codexRelativeOutputPath` in state points at the primary output file inside that tree.
 *
 * `inputParams` / `outputParams` are **open maps** of logical names → {@link ArtifactHandoffRef}. Defaults match
 * the Codex BA profile (`prompt`, `jiraContext`, `resultState`). Optional `primaryOutputKey` picks which output
 * entry becomes `codexRelativeOutputPath` when more than one output exists.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findFirstEnabledAsyncCallStepIndex,
  parseAgentPipelineSteps,
  type PipelineStepConfig,
} from './pipeline-config.js';

/** Repo-relative directory for async parent/child handoff (not `spec-output`; developer-agent may still use that). */
export const ASYNC_INVOCATION_HANDOFF_ROOT_DIR = 'async-invocation-handoff' as const;

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

/** Parse `step.contract`; missing param keys merge with {@link DEFAULT_AGENT_INVOCATION_CONTRACT}. */
export function parseAgentInvocationContractFromStep(step: PipelineStepConfig): AgentInvocationContract {
  const raw = (step as { contract?: unknown }).contract;
  if (!raw) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  if (!isRecord(raw)) throw new Error('invocation contract: step.contract must be an object');

  const inP = raw.inputParams;
  const outP = raw.outputParams;
  if (inP !== undefined && !isRecord(inP)) throw new Error('invocation contract: contract.inputParams must be an object');
  if (outP !== undefined && !isRecord(outP)) throw new Error('invocation contract: contract.outputParams must be an object');

  const def = DEFAULT_AGENT_INVOCATION_CONTRACT;
  const inputParams = shallowCloneArtifactMap(def.inputParams);
  if (inP) {
    for (const [k, v] of Object.entries(inP)) {
      inputParams[k] = parseArtifactInput(v, `inputParams.${k}`);
    }
  }

  /** When `outputParams` is set in JSON, it replaces the default map (use `primaryOutputKey` if not using `resultState`). */
  const outputParams: Record<string, ArtifactHandoffRef> = outP
    ? Object.fromEntries(
        Object.entries(outP).map(([k, v]) => [k, parseArtifactHandoffRef(v, `outputParams.${k}`)]),
      )
    : shallowCloneArtifactMap(def.outputParams);
  if (Object.keys(outputParams).length === 0) {
    throw new Error('invocation contract: outputParams must declare at least one artifact');
  }

  let primaryOutputKey: string | undefined;
  if (raw.primaryOutputKey !== undefined) {
    if (typeof raw.primaryOutputKey !== 'string' || !raw.primaryOutputKey.trim()) {
      throw new Error('invocation contract: primaryOutputKey must be a non-empty string when set');
    }
    primaryOutputKey = raw.primaryOutputKey.trim();
    if (!outputParams[primaryOutputKey]) {
      throw new Error(
        `invocation contract: primaryOutputKey "${primaryOutputKey}" is not present in contract.outputParams`,
      );
    }
  }

  for (const k of Object.keys(raw)) {
    if (!RESERVED_CONTRACT_ROOT_KEYS.has(k)) {
      throw new Error(
        `invocation contract: unknown property "${k}" on step.contract (allowed: inputParams, outputParams, primaryOutputKey)`,
      );
    }
  }

  return {
    ...(primaryOutputKey !== undefined ? { primaryOutputKey } : {}),
    inputParams,
    outputParams,
  };
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
  const steps = parseAgentPipelineSteps(raw, configLabel);
  const idx = findFirstEnabledAsyncCallStepIndex(steps);
  if (idx < 0) return { ...DEFAULT_AGENT_INVOCATION_CONTRACT };
  return parseAgentInvocationContractFromStep(steps[idx]!);
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
