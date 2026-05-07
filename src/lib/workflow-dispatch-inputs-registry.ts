/**
 * Declared `workflow_dispatch.inputs` keys for entry workflows (consumer copies).
 * Keep in sync with `.github/workflows/*.yml`. Used by {@link ./workflow-dispatch-validate.js}.
 */
export const WORKFLOW_DISPATCH_STRING_INPUT_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  'speckit-developer-agent.yml': new Set([
    'mode',
    'issue_number',
    'issue_key',
    'step',
    'branch_name',
    'pr_number',
    'prompt',
  ]),
  'ai-teammate.yml': new Set(['concurrency_key', 'config_file', 'caller_config']),
  'business-analyst.yml': new Set(['concurrency_key', 'config_file', 'caller_config']),
  'speckit-developer-agent-proceed.yml': new Set(['pr_number']),
};

/**
 * How `dispatch-pipeline-async-child-ci.ts` must build `workflow_dispatch` inputs from the parent pipeline.
 *
 * - **parent_correlation**: merge `caller_config` with callback + async_trigger_step (AI Teammate / BA child).
 *   Requires `async_call.terminal === false`.
 * - **standalone**: only keys declared on the target workflow — no `concurrency_key` / `config_file` / `caller_config`.
 *   Requires `async_call.terminal === true`.
 */
export type PipelineChildDispatchInputShape = 'parent_correlation' | 'standalone';

export const WORKFLOW_PIPELINE_CHILD_ASYNC_DISPATCH: Readonly<
  Record<string, { shape: PipelineChildDispatchInputShape }>
> = {
  'ai-teammate.yml': { shape: 'parent_correlation' },
  'business-analyst.yml': { shape: 'parent_correlation' },
  'speckit-developer-agent.yml': { shape: 'standalone' },
  'speckit-developer-agent-proceed.yml': { shape: 'standalone' },
};

export function getPipelineChildAsyncDispatchShape(
  workflowFile: string,
): PipelineChildDispatchInputShape | undefined {
  return WORKFLOW_PIPELINE_CHILD_ASYNC_DISPATCH[workflowFile.trim()]?.shape;
}

/**
 * Enforce `async_call.terminal` vs target workflow contract (fail fast; no workflow-specific hacks downstream).
 */
export function assertTerminalMatchesPipelineChildWorkflow(
  workflowFile: string,
  terminal: boolean,
  configLabel: string,
): void {
  const wf = workflowFile.trim();
  const meta = WORKFLOW_PIPELINE_CHILD_ASYNC_DISPATCH[wf];
  if (!meta) {
    throw new Error(
      `${configLabel}: async_call.workflowFile "${workflowFile}" is not registered for pipeline child dispatch. ` +
        'Add it to WORKFLOW_PIPELINE_CHILD_ASYNC_DISPATCH in src/lib/workflow-dispatch-inputs-registry.ts ' +
        '(and allowed keys to WORKFLOW_DISPATCH_STRING_INPUT_KEYS).',
    );
  }
  if (meta.shape === 'parent_correlation' && terminal) {
    throw new Error(
      `${configLabel}: "${workflowFile}" expects parent/child correlation (caller_config with callback) — ` +
        'set async_call.terminal to false.',
    );
  }
  if (meta.shape === 'standalone' && !terminal) {
    throw new Error(
      `${configLabel}: "${workflowFile}" declares standalone workflow_dispatch inputs only — ` +
        'set async_call.terminal to true (cannot send concurrency_key / config_file / caller_config).',
    );
  }
}

/** True when the registry lists allowed inputs for this workflow filename. */
export function isRegisteredWorkflowDispatchTarget(workflowFile: string): boolean {
  const id = workflowFile.trim();
  return id in WORKFLOW_DISPATCH_STRING_INPUT_KEYS;
}

export function getAllowedDispatchInputKeys(workflowFile: string): ReadonlySet<string> | undefined {
  const id = workflowFile.trim();
  return WORKFLOW_DISPATCH_STRING_INPUT_KEYS[id];
}
