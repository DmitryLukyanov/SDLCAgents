/**
 * create_github_issue runner.
 *
 * Creates a GitHub issue for the Jira ticket, labels it with jira:{ISSUE_KEY},
 * sets the body to a Jira snapshot (marker + markdown) only (BA progress uses issue comments, not the description),
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
  const issueBody = `${JIRA_CONTEXT_GITHUB_COMMENT_MARKER}\n\n${markdown}`;
  await deps.updateGithubIssueBody(owner, repo, issueNumber, issueBody);
  console.log(`  ✅ Set GitHub issue #${issueNumber} body with Jira snapshot`);

  const workflowRef = process.env.GITHUB_REF_NAME?.trim() || process.env.GITHUB_SHA?.trim() || 'unknown';
  await deps.addGithubIssueComment(
    owner,
    repo,
    issueNumber,
    [
      '### AI Teammate — pipeline start',
      '',
      `- **Config kind:** pipeline_agent`,
      `- **Config file:** \`${ctx.configFile}\``,
      `- **Workflow ref:** \`${workflowRef}\``,
      `- **Jira key:** \`${issueKey}\``,
    ].join('\n'),
  );
  console.log(`  ✅ Timeline: pipeline start comment on #${issueNumber}`);

  console.log(`  ✅ Created GitHub issue #${issueNumber}`);
  return { status: 'continue' };
}
