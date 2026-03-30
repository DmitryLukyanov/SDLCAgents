/**
 * dispatch_workflow runner.
 *
 * Dispatches a GitHub Actions workflow (specified by the "workflow" step config field)
 * with the current issue key, config file, and encoded config as inputs.
 *
 * Config:
 *   workflow — workflow filename to dispatch, e.g. "business-analyst.yml"
 */
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from '../runner-types.js';

export async function runDispatchWorkflow(
  ctx: RunnerContext,
  step: PipelineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo, ref, encodedConfig, configFile } = ctx;
  const workflowId = step.workflow as string | undefined;

  if (!workflowId) {
    throw new Error('dispatch_workflow step requires a "workflow" field (e.g. "business-analyst.yml")');
  }

  console.log(`  Dispatching ${workflowId} for ${issueKey}...`);

  await deps.dispatchWorkflow({
    owner,
    repo,
    workflow_id: workflowId,
    ref,
    inputs: {
      concurrency_key: issueKey,
      config_file: configFile,
      encoded_config: encodedConfig,
    },
  });

  console.log(`  ✅ Dispatched ${workflowId}`);
  return { status: 'continue' };
}
