/**
 * After the Codex BA job (pipeline resume): take the interpreted
 * BA result and persist it to Jira and the placeholder GitHub issue (labels, comments, close on incomplete).
 */
import { loadTemplate, fillTemplate } from '../../../lib/template-utils.js';
import type { BaOutcome } from '../../business-analyst/ba-types.js';
import type { AgentLabelParams, AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

const BA_COMPLETE = loadTemplate(import.meta.url, '..', 'templates', 'ba-complete.md');
const BA_INCOMPLETE = loadTemplate(import.meta.url, '..', 'templates', 'ba-incomplete.md');

export async function applyCodexBaOutcomeToJiraAndGithub(
  ctx: RunnerContext,
  agentLabelParams: AgentLabelParams,
  deps: AiTeammateDeps,
  outcome: BaOutcome,
): Promise<StepOutcome> {
  const { issueKey } = ctx;
  const { addLabel } = agentLabelParams;

  if (outcome.status === 'complete') {
    console.log('   ✅ BA analysis complete — all 5 fields extracted');

    if (addLabel) {
      await deps.addJiraIssueLabel(issueKey, addLabel).catch((e) => {
        console.warn(`   ⚠️ Could not add label "${addLabel}" to Jira (non-fatal):`, e);
      });
    }

    if (ctx.githubIssueNumber) {
      await deps
        .addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber, fillTemplate(BA_COMPLETE, { ISSUE_KEY: issueKey }))
        .catch(() => {
          /* non-fatal */
        });
    }

    return { status: 'continue' };
  }

  console.log('\n── BA: Analysis incomplete — blocking ticket ──');

  try {
    await deps.addIssueComment(issueKey, outcome.questions);
    console.log('   ✅ Posted questions to Jira');
  } catch (e) {
    console.error('   ❌ Failed to post questions to Jira:', e);
  }

  if (ctx.githubIssueNumber) {
    try {
      await deps
        .addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber, fillTemplate(BA_INCOMPLETE, { ISSUE_KEY: issueKey }))
        .catch(() => {
          /* non-fatal */
        });
      await deps.closeGithubIssue(ctx.owner, ctx.repo, ctx.githubIssueNumber);
      console.log(`   ✅ Closed placeholder GitHub issue #${ctx.githubIssueNumber}`);
    } catch (e) {
      console.warn('   ⚠️ Could not close GitHub issue (non-fatal):', e);
    }
  }

  return { status: 'stop', reason: 'BA analysis incomplete — questions posted, ticket blocked' };
}
