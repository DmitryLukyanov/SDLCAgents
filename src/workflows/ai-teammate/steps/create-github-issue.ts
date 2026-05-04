/**
 * create_github_issue runner.
 *
 * Creates a placeholder GitHub issue for the Jira ticket, labels it with
 * jira:{ISSUE_KEY}, posts a Jira context snapshot comment (marker + markdown),
 * and stores the issue number in the pipeline context for downstream steps.
 */
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';
import {
  buildMinimalJiraGithubCommentMarkdown,
  JIRA_CONTEXT_GITHUB_COMMENT_MARKER,
} from '../jira-github-comment.js';

export async function runCreateGithubIssue(
  ctx: RunnerContext,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo } = ctx;

  console.log(`  Creating GitHub issue for ${issueKey}...`);

  const issueNumber = await deps.createGithubIssue(owner, repo, issueKey);
  ctx.githubIssueNumber = issueNumber;

  const depthRaw = parseInt(process.env.TICKET_CONTEXT_DEPTH ?? '1', 10);
  const ticketContextDepth = !Number.isNaN(depthRaw) && depthRaw >= 0 ? depthRaw : 1;
  const markdown = await buildMinimalJiraGithubCommentMarkdown({
    issueKey,
    ticketContextDepth,
    getIssue: deps.getIssue,
    fetchRelatedIssueSummaries: deps.fetchRelatedIssueSummaries,
  });
  const commentBody = `${JIRA_CONTEXT_GITHUB_COMMENT_MARKER}\n\n${markdown}`;
  await deps.addGithubIssueComment(owner, repo, issueNumber, commentBody);
  console.log(`  ✅ Posted Jira context comment on GitHub issue #${issueNumber}`);

  console.log(`  ✅ Created GitHub issue #${issueNumber}`);
  return { status: 'continue' };
}
