/**
 * create_github_issue runner.
 *
 * Creates a GitHub issue for the Jira ticket, labels it with jira:{ISSUE_KEY},
 * sets the body to the BA placeholder plus a Jira snapshot (marker + markdown),
 * and stores the issue number in the pipeline context for downstream steps.
 */
import { fillTemplate, loadTemplate } from '../../../lib/template-utils.js';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';
import {
  buildMinimalJiraGithubCommentMarkdown,
  JIRA_CONTEXT_GITHUB_COMMENT_MARKER,
} from '../jira-github-comment.js';

const PLACEHOLDER_TEMPLATE = loadTemplate(import.meta.url, '..', 'templates', 'github-issue-placeholder.md');

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
  const lead = fillTemplate(PLACEHOLDER_TEMPLATE, { ISSUE_KEY: issueKey });
  const issueBody = `${lead}\n\n${JIRA_CONTEXT_GITHUB_COMMENT_MARKER}\n\n${markdown}`;
  await deps.updateGithubIssueBody(owner, repo, issueNumber, issueBody);
  console.log(`  ✅ Set GitHub issue #${issueNumber} body with Jira snapshot`);

  console.log(`  ✅ Created GitHub issue #${issueNumber}`);
  return { status: 'continue' };
}
