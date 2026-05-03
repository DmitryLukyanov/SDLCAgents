/**
 * GitHub workflow routing: payload builders + {@link dispatchGithubWorkflow} (Octokit REST or injectable sink).
 *
 * `caller_config` helpers read optional process env where noted; keep env unset in unit tests.
 */
import { Octokit } from '@octokit/rest';
import type { CallerConfigParams } from './caller-config.js';
import { encodeCallerConfig } from './caller-config.js';

/**
 * Payload for `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`
 * (Octokit: `createWorkflowDispatch`). Index signature keeps it assignable to Octokit `RequestParameters`.
 */
export interface GithubWorkflowDispatchPayload {
  [key: string]: unknown;
  owner: string;
  repo: string;
  workflow_id: string;
  ref: string;
  inputs: Record<string, string>;
}

/**
 * Build the workflow dispatch body. `workflowId` is the workflow filename (e.g. `ai-teammate.yml`).
 */
export function buildGithubWorkflowDispatchPayload(params: {
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
  inputs: Record<string, string>;
}): GithubWorkflowDispatchPayload {
  return {
    owner: params.owner,
    repo: params.repo,
    workflow_id: params.workflowId,
    ref: params.ref,
    inputs: params.inputs,
  };
}

/**
 * URL-encoded JSON `{ params: { inputJql, customParams? } }` for workflow input `caller_config` / env `CALLER_CONFIG`.
 * Reads optional env: `REQUIRED_JIRA_STATUS`, `POST_READ_STATUS`, `TICKET_CONTEXT_DEPTH` (same semantics as Scrum Master).
 */
export function buildAiTeammateCallerConfigEncoded(ticketKey: string): string {
  const customParams: Record<string, string> = {};
  const taken = process.env.REQUIRED_JIRA_STATUS?.trim();
  const move = process.env.POST_READ_STATUS?.trim();
  if (taken) customParams.taken_status = taken;
  if (move) customParams.status_to_move_to = move;
  const depth = process.env.TICKET_CONTEXT_DEPTH?.trim() || '1';
  customParams.ticket_context_depth = depth;

  const params: CallerConfigParams = {
    inputJql: `key = ${ticketKey}`,
  };
  if (Object.keys(customParams).length > 0) {
    params.customParams = customParams;
  }

  return encodeCallerConfig({ params });
}

/**
 * Inputs for `octokit.rest.actions.createWorkflowDispatch` when starting AI Teammate for one Jira issue
 * (`concurrency_key`, `config_file`, `caller_config`).
 */
export function buildAiTeammateWorkflowDispatchInputs(
  issueKey: string,
  agentConfigFile: string,
): Record<string, string> {
  return {
    concurrency_key: issueKey,
    config_file: agentConfigFile,
    caller_config: buildAiTeammateCallerConfigEncoded(issueKey),
  };
}

/**
 * Same `inputs` shape as {@link buildAiTeammateWorkflowDispatchInputs} when `caller_config` is already
 * URL-encoded (e.g. async child callback — see `dispatch-parent-callback-workflow-ci.ts`).
 */
export function buildAiTeammateWorkflowDispatchInputsWithCaller(params: {
  concurrencyKey: string;
  configFile: string;
  callerConfigEncoded: string;
}): Record<string, string> {
  return {
    concurrency_key: params.concurrencyKey,
    config_file: params.configFile,
    caller_config: params.callerConfigEncoded,
  };
}

/** Repo defaults for resolving which workflow/ref to dispatch (structurally matches `ScrumMasterContext`). */
export type EntryWorkflowDispatchHost = {
  owner: string;
  repo: string;
  ref: string;
  defaultWorkflowFile: string;
};

/** Rule fragment: agent config path + optional workflow override (structurally matches `SmRule`). */
export type EntryWorkflowDispatchRule = {
  configFile: string;
  workflowFile?: string;
  workflowRef?: string;
};

/**
 * Effective workflow filename and git ref (`rule.workflowFile || host.defaultWorkflowFile`, etc.).
 */
export function resolveEntryWorkflowDispatchTarget(
  host: EntryWorkflowDispatchHost,
  rule: EntryWorkflowDispatchRule,
): { workflowId: string; ref: string } {
  return {
    workflowId: rule.workflowFile || host.defaultWorkflowFile,
    ref: rule.workflowRef || host.ref,
  };
}

/** Injected `workflow_dispatch` caller (tests: mock this instead of Octokit). */
export type GithubWorkflowDispatchSink = {
  dispatchWorkflow: (args: GithubWorkflowDispatchPayload) => Promise<void>;
};

function isGithubWorkflowDispatchSink(x: Octokit | GithubWorkflowDispatchSink): x is GithubWorkflowDispatchSink {
  return typeof (x as GithubWorkflowDispatchSink).dispatchWorkflow === 'function';
}

/**
 * Run `workflow_dispatch` for a payload from {@link buildGithubWorkflowDispatchPayload}.
 * Pass **Octokit** to call `octokit.rest.actions.createWorkflowDispatch`; pass a **sink** to inject behaviour (tests).
 */
export async function dispatchGithubWorkflow(
  client: Octokit | GithubWorkflowDispatchSink,
  payload: GithubWorkflowDispatchPayload,
): Promise<void> {
  if (isGithubWorkflowDispatchSink(client)) {
    await client.dispatchWorkflow(payload);
    return;
  }
  await client.rest.actions.createWorkflowDispatch({
    owner: payload.owner,
    repo: payload.repo,
    workflow_id: payload.workflow_id,
    ref: payload.ref,
    inputs: payload.inputs,
  });
}

/**
 * Dispatch the configured **entry** workflow for one mapped issue: resolve target from host + rule,
 * build `concurrency_key` / `config_file` / `caller_config` from the Jira key (`buildAiTeammateWorkflowDispatchInputs`).
 *
 * This is **not** used for async parent callback: that path reads `params.callback` and a pre-built
 * `caller_config` instead — build the payload with {@link buildAiTeammateWorkflowDispatchInputsWithCaller}
 * and call {@link dispatchGithubWorkflow}.
 */
export async function dispatchEntryWorkflowForMappedIssue(
  deps: GithubWorkflowDispatchSink,
  host: EntryWorkflowDispatchHost,
  rule: EntryWorkflowDispatchRule,
  issueKey: string,
): Promise<void> {
  const { workflowId, ref } = resolveEntryWorkflowDispatchTarget(host, rule);
  const payload = buildGithubWorkflowDispatchPayload({
    owner: host.owner,
    repo: host.repo,
    workflowId,
    ref,
    inputs: buildAiTeammateWorkflowDispatchInputs(issueKey, rule.configFile),
  });
  await dispatchGithubWorkflow(deps, payload);
}
