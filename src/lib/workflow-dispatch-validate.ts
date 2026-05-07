import {
  getAllowedDispatchInputKeys,
  isRegisteredWorkflowDispatchTarget,
} from './workflow-dispatch-inputs-registry.js';

export class WorkflowDispatchInputValidationError extends Error {
  constructor(
    message: string,
    readonly workflowFile: string,
    readonly providedKeys: string[],
    readonly rejectedKeys: string[],
  ) {
    super(message);
    this.name = 'WorkflowDispatchInputValidationError';
  }
}

/**
 * Ensure `inputs` keys are a subset of the target workflow's declared `workflow_dispatch` inputs (FR-008).
 * Unknown keys → throws {@link WorkflowDispatchInputValidationError} (FR-016 fields available on error).
 */
export function assertWorkflowDispatchInputsAllowed(
  workflowFile: string,
  inputs: Record<string, string>,
): void {
  const wf = workflowFile.trim();
  if (!wf) throw new Error('[dispatch-validate] workflowFile is required');

  if (!isRegisteredWorkflowDispatchTarget(wf)) {
    console.warn(
      `[dispatch-validate] No input allowlist for "${wf}" — skipping key validation (add to workflow-dispatch-inputs-registry.ts).`,
    );
    return;
  }

  const allowed = getAllowedDispatchInputKeys(wf)!;
  const providedKeys = Object.keys(inputs);
  const rejectedKeys = providedKeys.filter((k) => !allowed.has(k));
  if (rejectedKeys.length === 0) return;

  throw new WorkflowDispatchInputValidationError(
    `${wf}: workflow_dispatch inputs contain unknown keys: ${rejectedKeys.join(', ')} ` +
      `(allowed: ${[...allowed].sort().join(', ')})`,
    wf,
    providedKeys,
    rejectedKeys,
  );
}

/** Operator-facing body for GitHub issue timeline (FR-016). */
export function formatDispatchValidationIssueComment(err: WorkflowDispatchInputValidationError): string {
  return [
    '### Dispatch input validation failed',
    '',
    `- **Target workflow:** \`${err.workflowFile}\``,
    `- **Provided input keys:** ${err.providedKeys.length ? err.providedKeys.map((k) => `\`${k}\``).join(', ') : '_none_'}`,
    `- **Rejected / unknown keys:** ${err.rejectedKeys.map((k) => `\`${k}\``).join(', ')}`,
    '',
    `_Resolve by aligning dispatch payload with the workflow's declared \`on.workflow_dispatch.inputs\`._`,
  ].join('\n');
}
