/**
 * GitHub workflow routing: payload builders + {@link dispatchGithubWorkflow} (Octokit REST or injectable sink).
 *
 * `caller_config` helpers read optional process env where noted; keep env unset in unit tests.
 */
import { Octokit } from '@octokit/rest';
import type { CallerConfigParams } from './caller-config.js';
import { encodeCallerConfig } from './caller-config.js';
import { assertWorkflowDispatchInputsAllowed } from './workflow-dispatch-validate.js';
import {
  assertTerminalMatchesPipelineChildWorkflow,
  getAllowedDispatchInputKeys,
  getPipelineChildAsyncDispatchShape,
} from './workflow-dispatch-inputs-registry.js';

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
 * Reads optional env: `REQUIRED_JIRA_STATUS`, `POST_READ_STATUS`, `TICKET_CONTEXT_DEPTH`
 * (Scrum Master sets these from each rule’s `requiredJiraStatus` / `postReadStatus` while that rule runs.)
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

/** Baseline inputs for `standalone` child workflows (extend registry + this switch when adding targets). */
function buildStandaloneChildDispatchBaseline(
  workflowFile: string,
  handoff: { issueKey: string; githubIssueNumber: string; step: string },
): Record<string, string> {
  const wf = workflowFile.trim();
  if (wf === 'speckit-developer-agent.yml') {
    return {
      mode: 'speckit',
      issue_number: handoff.githubIssueNumber,
      issue_key: handoff.issueKey,
      step: handoff.step,
      branch_name: '',
      pr_number: '',
      prompt: '',
    };
  }
  if (wf === 'speckit-developer-agent-proceed.yml') {
    return { pr_number: '' };
  }
  throw new Error(
    `[routing_helper] No standalone dispatch baseline for "${workflowFile}". ` +
      'Add defaults in buildStandaloneChildDispatchBaseline.',
  );
}

/**
 * Merge `async_call.inputs` into dispatch inputs; reject keys not declared on the target workflow.
 */
export function mergeAsyncCallInputsForTargetWorkflow(
  workflowFile: string,
  inputs: Record<string, string>,
  asyncCallInputs: Record<string, string> | undefined,
  configLabel: string,
): void {
  if (!asyncCallInputs) return;
  const allowed = getAllowedDispatchInputKeys(workflowFile.trim());
  if (!allowed) {
    throw new Error(`${configLabel}: "${workflowFile}" has no input allowlist — add to WORKFLOW_DISPATCH_STRING_INPUT_KEYS.`);
  }
  for (const [k, v] of Object.entries(asyncCallInputs)) {
    if (!allowed.has(k)) {
      throw new Error(
        `${configLabel}: async_call.inputs.${k} is not a declared input on "${workflowFile}" ` +
          `(allowed: ${[...allowed].sort().join(', ')}).`,
      );
    }
    if (v !== undefined && v !== null) inputs[k] = String(v);
  }
}

/**
 * Build `workflow_dispatch.inputs` for a child started from the AI Teammate pipeline async handoff job.
 * Centralizes parent_correlation vs standalone shapes and terminal rules (see registry).
 */
export function buildAsyncChildWorkflowDispatchInputs(params: {
  workflowFile: string;
  terminal: boolean;
  configLabel: string;
  concurrencyKey: string;
  configFile: string;
  callerConfigEncoded: string;
  handoffIssueKey: string;
  handoffGithubIssueNumber: string;
  /** Default for workflows that use a `step` input (e.g. SpecKit entry); overridden by `async_call.inputs`. */
  standaloneDefaultStep: string;
  asyncCallInputs?: Record<string, string>;
}): Record<string, string> {
  const wf = params.workflowFile.trim();
  assertTerminalMatchesPipelineChildWorkflow(wf, params.terminal, params.configLabel);
  const shape = getPipelineChildAsyncDispatchShape(wf);
  if (!shape) {
    throw new Error(`[routing_helper] Missing pipeline child shape for "${wf}"`);
  }

  let inputs: Record<string, string>;
  if (shape === 'parent_correlation') {
    inputs = buildAiTeammateWorkflowDispatchInputsWithCaller({
      concurrencyKey: params.concurrencyKey,
      configFile: params.configFile,
      callerConfigEncoded: params.callerConfigEncoded,
    });
  } else {
    inputs = buildStandaloneChildDispatchBaseline(wf, {
      issueKey: params.handoffIssueKey.trim(),
      githubIssueNumber: params.handoffGithubIssueNumber.trim(),
      step: params.standaloneDefaultStep.trim() || 'specify',
    });
  }

  mergeAsyncCallInputsForTargetWorkflow(wf, inputs, params.asyncCallInputs, params.configLabel);
  return inputs;
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
  assertWorkflowDispatchInputsAllowed(
    String(payload.workflow_id),
    payload.inputs as Record<string, string>,
  );
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
