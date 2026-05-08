/**
 * Shared loading for agent JSON configs on disk (pipeline agent shape only):
 *   • `params.runner` + non-empty `params.steps[]` (AI Teammate, Scrum Master, …)
 *
 * Shape is classified via `detectAgentConfigKind` (see `agent-config-validate.ts`).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AgentJsonWithPipeline } from './pipeline-config.js';
import { detectAgentConfigKind } from './agent-config-validate.js';

export interface ReadAgentConfigFileResult {
  abs: string;
  raw: string;
  root: unknown;
}

/** Resolve path from cwd, read UTF-8, parse JSON. */
export async function readAgentConfigFile(filePath: string): Promise<ReadAgentConfigFileResult> {
  const abs = resolve(process.cwd(), filePath);
  let raw: string;
  try {
    raw = await readFile(abs, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read agent config file ${abs}: ${e instanceof Error ? e.message : String(e)}`);
  }
  let root: unknown;
  try {
    root = JSON.parse(raw) as unknown;
  } catch (e) {
    throw new Error(`${abs}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  return { abs, raw, root };
}

/** Require a pipeline agent config (non-empty `params.steps`). */
export function assertKnownAgentConfigKind(root: unknown, abs: string): void {
  const kind = detectAgentConfigKind(root);
  if (kind) return;
  throw new Error(
    `${abs}: unknown agent config shape. Expected pipeline agent JSON with non-empty "params.steps". ` +
      `(Scrum Master formerly used top-level "rules" — migrate to params.steps with runner "sm_dispatch_rule".)`,
  );
}

export interface ReadPipelineAgentConfigFileResult {
  abs: string;
  raw: string;
  root: AgentJsonWithPipeline;
}

/**
 * Pipeline agent JSON (AI Teammate, Scrum Master, …).
 * Returns parsed root plus raw text for `parseAgentPipelineSteps(raw, …)` (must match file bytes).
 */
export async function readPipelineAgentConfigFile(
  filePath: string,
): Promise<ReadPipelineAgentConfigFileResult> {
  const { abs, raw, root } = await readAgentConfigFile(filePath);
  assertKnownAgentConfigKind(root, abs);
  const agent = root as AgentJsonWithPipeline;
  const steps = agent.params?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`${abs}: pipeline agent requires non-empty params.steps`);
  }
  return { abs, raw, root: agent };
}
