/**
 * Shared Jira skip-if-label gate for pipeline agents.
 *
 * 1. Load agent JSON from a **config file path** and read **`params.skipIfLabel`**.
 * 2. Load Jira labels via **`getIssueLabelNames`** in `jira/jira-client.ts`.
 * 3. If the issue already has that label → non-empty **skip reason**; otherwise → empty (do not skip).
 *
 * Workflow-specific checks (e.g. concurrency env) stay in per-agent CI entrypoints.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getIssueLabelNames } from './jira/jira-client.js';

/** Single-line, no double-quotes — safe for `GITHUB_OUTPUT` / env passthrough in YAML. */
export function formatSkipIfLabelHitReason(skipIfLabel: string): string {
  return `already_labelled_${skipIfLabel.replace(/\s+/g, '_')}`;
}

export function parseSkipIfLabelFromAgentJson(agent: unknown): string {
  if (!agent || typeof agent !== 'object') return '';
  const params = (agent as { params?: unknown }).params;
  if (!params || typeof params !== 'object') return '';

  const p = params as { skipIfLabel?: unknown };
  return typeof p.skipIfLabel === 'string' ? p.skipIfLabel.trim() : '';
}

/** Read agent JSON from disk (path relative to `cwd`, default `process.cwd()`). */
export async function readAgentJsonFromConfigFile(
  configFilePath: string,
  cwd: string = process.cwd(),
): Promise<unknown> {
  const abs = resolve(cwd, configFilePath);
  const raw = await readFile(abs, 'utf8');
  return JSON.parse(raw) as unknown;
}

/**
 * Resolve **`skipIfLabel`** from an on-disk agent config (same rules as {@link parseSkipIfLabelFromAgentJson}).
 */
export async function parseSkipIfLabelFromConfigFile(
  configFilePath: string,
  cwd?: string,
): Promise<string> {
  const agentJson = await readAgentJsonFromConfigFile(configFilePath, cwd ?? process.cwd());
  return parseSkipIfLabelFromAgentJson(agentJson);
}

/**
 * If `skipIfLabel` is set and the issue already has that label, returns a non-empty skip reason;
 * otherwise returns an empty string (do not skip the downstream segment).
 */
export function computeSkipIfLabelReason(
  skipIfLabel: string,
  issueLabelNames: readonly string[],
): string {
  if (!skipIfLabel) return '';
  return issueLabelNames.includes(skipIfLabel) ? formatSkipIfLabelHitReason(skipIfLabel) : '';
}

export interface EvaluateSkipIfLabelInput {
  /** Parsed root agent object (e.g. from `JSON.parse` of `*.config`). */
  agentJson: unknown;
  issueKey: string;
  /** Return Jira label names for the issue (tests may inject; default path uses {@link getIssueLabelNames}). */
  fetchIssueLabelNames: (issueKey: string) => Promise<readonly string[]>;
}

export interface EvaluateSkipIfLabelResult {
  /** Empty = run the gated segment; non-empty = skip (pass to workflow / finish). */
  skipReason: string;
  /** Resolved gate label from config (empty if unset). */
  skipIfLabel: string;
}

/**
 * Given parsed agent JSON: resolve gate label, load Jira labels, compute `skipReason`.
 */
export async function evaluateSkipIfLabel(input: EvaluateSkipIfLabelInput): Promise<EvaluateSkipIfLabelResult> {
  const skipIfLabel = parseSkipIfLabelFromAgentJson(input.agentJson);
  if (!skipIfLabel) {
    return { skipReason: '', skipIfLabel: '' };
  }
  const labels = await input.fetchIssueLabelNames(input.issueKey);
  const skipReason = computeSkipIfLabelReason(skipIfLabel, labels);
  return { skipReason, skipIfLabel };
}

export interface EvaluateSkipIfLabelFromConfigFileInput {
  /** Agent JSON path (e.g. `CONFIG_FILE`), resolved against `cwd`. */
  configFilePath: string;
  issueKey: string;
  cwd?: string;
  /** Override Jira fetch (defaults to {@link getIssueLabelNames}). */
  fetchIssueLabelNames?: (issueKey: string) => Promise<readonly string[]>;
}

/**
 * Full path: read config file → **`params.skipIfLabel`** → Jira labels → skip vs continue.
 */
export async function evaluateSkipIfLabelFromConfigFile(
  input: EvaluateSkipIfLabelFromConfigFileInput,
): Promise<EvaluateSkipIfLabelResult> {
  const agentJson = await readAgentJsonFromConfigFile(input.configFilePath, input.cwd ?? process.cwd());
  const fetcher = input.fetchIssueLabelNames ?? getIssueLabelNames;
  return evaluateSkipIfLabel({
    agentJson,
    issueKey: input.issueKey,
    fetchIssueLabelNames: fetcher,
  });
}
