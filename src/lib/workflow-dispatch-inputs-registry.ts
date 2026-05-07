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

/** True when the registry lists allowed inputs for this workflow filename. */
export function isRegisteredWorkflowDispatchTarget(workflowFile: string): boolean {
  const id = workflowFile.trim();
  return id in WORKFLOW_DISPATCH_STRING_INPUT_KEYS;
}

export function getAllowedDispatchInputKeys(workflowFile: string): ReadonlySet<string> | undefined {
  const id = workflowFile.trim();
  return WORKFLOW_DISPATCH_STRING_INPUT_KEYS[id];
}
