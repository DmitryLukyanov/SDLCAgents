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
  const { addLabel, incompleteStatus } = agentLabelParams;

  if (outcome.status === 'complete') {
    console.log('   ✅ BA analysis complete — all 5 fields extracted');

    if (addLabel) {
      await deps.addJiraIssueLabel(issueKey, addLabel).catch((e) => {
        console.warn(`   ⚠️ Could not add label "${addLabel}" to Jira (non-fatal):`, e);
      });
    }

    if (ctx.githubIssueNumber) {
      // Add comment about BA completion
      await deps
        .addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber, fillTemplate(BA_COMPLETE, { ISSUE_KEY: issueKey }))
        .catch(() => {
          /* non-fatal */
        });

      // Append pipeline config to issue body so developer agent can read it
      try {
        const pipelineConfig = {
          specifyInput: outcome.result.specifyInput ?? '',
          clarifyInput: outcome.result.clarifyInput ?? '',
          planInput: outcome.result.planInput ?? '',
          tasksInput: outcome.result.tasksInput ?? '',
          implementInput: outcome.result.implementInput ?? '',
        };
        const configBlock = `\n\n<!--sdlc-pipeline-config\n${JSON.stringify(pipelineConfig, null, 2)}\n/sdlc-pipeline-config-->`;

        // Get current issue body and append config
        const currentBody = await deps.getGithubIssueBody(ctx.owner, ctx.repo, ctx.githubIssueNumber);
        // Only append if not already present
        if (!currentBody.includes('<!--sdlc-pipeline-config')) {
          await deps.updateGithubIssueBody(ctx.owner, ctx.repo, ctx.githubIssueNumber, currentBody + configBlock);
          console.log('   ✅ Appended pipeline config to GitHub issue body');
        }
      } catch (e) {
        console.warn('   ⚠️ Could not append pipeline config to GitHub issue (non-fatal):', e);
      }
    }

    return { status: 'continue' };
  }

  console.log('\n── BA: Analysis incomplete — blocking ticket ──');

  if (incompleteStatus) {
    await deps.transitionIssueToStatusName(issueKey, incompleteStatus);
    console.log(`   ✅ Transitioned ${issueKey} to "${incompleteStatus}"`);
  }

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
