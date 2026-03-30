/**
 * update_issue runner.
 *
 * Posts results back to Jira based on the LLM outcome stored in context:
 *   - Complete   → posts success comment + adds label → continues pipeline
 *   - Incomplete → posts questions + transitions to Blocked + adds label → stops pipeline
 */
import type { BusinessAnalystContext } from '../business-analyst-core.js';
import type { BaPipelineContext, BaPipelineDeps, BaStepOutcome } from '../ba-runner-types.js';

export async function runUpdateIssue(
  ctx: BaPipelineContext,
  deps: BaPipelineDeps,
  baCtx: BusinessAnalystContext,
): Promise<BaStepOutcome> {
  const { issueKey } = ctx;

  if (!ctx.outcome) {
    throw new Error('update_issue: no outcome in context — llm_evaluate must run first');
  }

  const { outcome } = ctx;

  if (outcome.status === 'complete') {
    console.log('\n── Analysis COMPLETE — posting success comment + label ──');

    try {
      await deps.addIssueComment(
        issueKey,
        'Business Analyst analysis complete — all 5 fields extracted. Dispatching AI Teammate.',
      );
    } catch (e) {
      console.warn('   ⚠️ Jira comment failed (non-fatal):', e);
    }

    try {
      await deps.addIssueLabel(issueKey, baCtx.analyzedLabel);
      console.log(`   Label +${baCtx.analyzedLabel}`);
    } catch (e) {
      console.warn('   ⚠️ Could not add label (non-fatal):', e);
    }

    return { status: 'continue' };
  }

  // Incomplete
  console.log('\n── Analysis INCOMPLETE — posting questions + blocking ticket ──');

  try {
    await deps.addIssueComment(issueKey, outcome.questions);
    console.log('   ✅ Posted questions to Jira');
  } catch (e) {
    console.error('   ❌ Failed to post questions to Jira:', e);
  }

  try {
    await deps.transitionIssueToStatusName(issueKey, baCtx.blockedStatusName);
    console.log(`   ✅ Transitioned ${issueKey} to "${baCtx.blockedStatusName}"`);
  } catch (e) {
    console.warn('   ⚠️ Could not transition to Blocked (non-fatal):', e);
  }

  try {
    await deps.addIssueLabel(issueKey, baCtx.analyzedLabel);
    console.log(`   Label +${baCtx.analyzedLabel}`);
  } catch (e) {
    console.warn('   ⚠️ Could not add label (non-fatal):', e);
  }

  return { status: 'stop', reason: 'Analysis incomplete — ticket blocked, questions posted' };
}
