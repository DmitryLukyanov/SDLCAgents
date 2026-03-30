/**
 * assign_copilot runner.
 *
 * Enriches the encoded config with BA analysis results and dispatches
 * the AI Teammate workflow to hand off to the Copilot Coding Agent.
 */
import { enrichEncodedConfig, type BusinessAnalystContext } from '../business-analyst-core.js';
import type { BaPipelineContext, BaPipelineDeps, BaStepOutcome } from '../ba-runner-types.js';

export async function runAssignCopilot(
  ctx: BaPipelineContext,
  deps: BaPipelineDeps,
  baCtx: BusinessAnalystContext,
): Promise<BaStepOutcome> {
  if (!ctx.outcome || ctx.outcome.status !== 'complete') {
    return { status: 'stop', reason: 'No complete analysis in context — skipping dispatch' };
  }

  console.log('\n── Dispatching AI Teammate workflow ──');

  const enriched = enrichEncodedConfig(baCtx.encodedConfig, ctx.outcome.result);

  try {
    await deps.dispatchWorkflow({
      owner: baCtx.owner,
      repo: baCtx.repo,
      workflow_id: baCtx.aiTeammateWorkflowFile,
      ref: baCtx.ref,
      inputs: {
        concurrency_key: baCtx.issueKey,
        config_file: baCtx.configFile,
        encoded_config: enriched,
      },
    });
    console.log(`   ✅ Dispatched ${baCtx.aiTeammateWorkflowFile} for ${baCtx.issueKey}`);
  } catch (e) {
    console.error('   ❌ Failed to dispatch AI Teammate:', e);
    throw e;
  }

  return { status: 'continue' };
}
