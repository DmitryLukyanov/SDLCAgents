/**
 * Business Analyst pipeline runner.
 *
 * Executes an ordered list of steps driven by the BA config's `steps` array.
 * Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   llm_evaluate   — fetches Jira data + related issues, runs LLM analysis
 *   update_issue   — posts comment/label to Jira; blocks ticket if analysis incomplete
 *   assign_copilot — enriches encoded config and dispatches AI Teammate workflow
 */
import { runLlmEvaluate } from './steps/llm-evaluate.js';
import { runUpdateIssue } from './steps/update-issue.js';
import { runAssignCopilot } from './steps/assign-copilot.js';
import type { BusinessAnalystContext } from './business-analyst-core.js';
import type { BaPipelineContext, BaPipelineDeps, BaPipelineStep, BaStepOutcome } from './ba-runner-types.js';

async function executeStep(
  ctx: BaPipelineContext,
  step: BaPipelineStep,
  deps: BaPipelineDeps,
  baCtx: BusinessAnalystContext,
): Promise<BaStepOutcome> {
  switch (step.runner) {
    case 'llm_evaluate':
      return runLlmEvaluate(ctx, deps, baCtx);
    case 'update_issue':
      return runUpdateIssue(ctx, deps, baCtx);
    case 'assign_copilot':
      return runAssignCopilot(ctx, deps, baCtx);
    default:
      throw new Error(
        `Unknown BA pipeline step runner: "${step.runner}". ` +
          `Supported: llm_evaluate, update_issue, assign_copilot.`,
      );
  }
}

export async function runBaPipeline(
  baCtx: BusinessAnalystContext,
  steps: BaPipelineStep[],
  deps: BaPipelineDeps,
): Promise<void> {
  const ctx: BaPipelineContext = { issueKey: baCtx.issueKey };

  console.log(`\nBA Pipeline starting for ${baCtx.issueKey} (${steps.length} step(s))`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.enabled === false) {
      console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} (skipped — disabled) ──`);
      continue;
    }

    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} ──`);

    const outcome = await executeStep(ctx, step, deps, baCtx);

    if (outcome.status === 'stop') {
      console.log(`\n🛑 BA Pipeline halted at step ${i + 1} (${step.runner}): ${outcome.reason}`);
      return;
    }
  }

  console.log(`\nBA Pipeline finished all ${steps.length} step(s) for ${baCtx.issueKey}.`);
}
