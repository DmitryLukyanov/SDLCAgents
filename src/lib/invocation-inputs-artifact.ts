/**
 * Canonical invocation-inputs artifact name (FR-006).
 * Upload as workflow artifact; name must stay stable for operators and resume flows.
 */
export function buildInvocationInputsArtifactName(issueKey: string, stepId: string): string {
  const k = issueKey.trim();
  const s = stepId.trim();
  if (!k) throw new Error('[invocation-inputs-artifact] issueKey is required');
  if (!s) throw new Error('[invocation-inputs-artifact] stepId is required');
  return `invocation-inputs_${k}_${s}`;
}

/** Repo-relative JSON path (optional convention for jobs that upload a single file). */
export function buildInvocationInputsArtifactRelativePath(issueKey: string, stepId: string): string {
  return `${buildInvocationInputsArtifactName(issueKey, stepId)}.json`;
}
