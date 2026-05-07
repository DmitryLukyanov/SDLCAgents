/**
 * Pipeline `runner` strings implemented in this repository (FR-007, US4).
 * Update when adding a new step runner switch arm.
 */
export const IMPLEMENTED_PIPELINE_RUNNERS = new Set<string>([
  // AI Teammate — src/workflows/ai-teammate/ai-teammate-pipeline.ts
  'ensure_jira_fields_expected',
  'create_github_issue',
  'async_operation',
  'async_terminal_operation',
  'apply_ba_outcome',
  // SpecKit Developer Agent — src/workflows/speckit-developer-agent/speckit-developer-agent-pipeline.ts
  'validate_spec_kit_prerequisites',
  'spec_kit_step',
  'validate_spec_kit_output',
]);

/** Hint paths for operators when a runner is missing. */
export const PIPELINE_RUNNER_IMPLEMENTATION_HINT: Readonly<Record<string, string>> = {
  ensure_jira_fields_expected: 'src/workflows/ai-teammate/steps/ensure-jira-fields-expected.ts',
  create_github_issue: 'src/workflows/ai-teammate/steps/create-github-issue.ts',
  async_operation: 'src/workflows/ai-teammate/ai-teammate-pipeline.ts (async_operation)',
  async_terminal_operation: 'src/workflows/ai-teammate/ai-teammate-pipeline.ts (async_terminal_operation)',
  apply_ba_outcome: 'src/workflows/ai-teammate/steps/apply-ba-outcome.ts',
  validate_spec_kit_prerequisites: 'src/workflows/speckit-developer-agent/speckit-developer-agent-pipeline.ts',
  spec_kit_step: 'src/workflows/speckit-developer-agent/speckit-developer-agent-pipeline.ts',
  validate_spec_kit_output: 'src/workflows/speckit-developer-agent/speckit-developer-agent-pipeline.ts',
};

export function assertPipelineRunnerImplemented(runner: string, configLabel: string): void {
  const r = runner.trim();
  if (!r) throw new Error(`${configLabel}: step.runner is empty`);
  if (IMPLEMENTED_PIPELINE_RUNNERS.has(r)) return;
  const hint = PIPELINE_RUNNER_IMPLEMENTATION_HINT[r] ?? 'src/workflows/** (add case to the appropriate *-pipeline.ts)';
  throw new Error(
    `${configLabel}: unknown or unimplemented pipeline step runner "${r}". ` +
      `Implement it in the agent pipeline (hint: ${hint}) or fix the config.`,
  );
}
