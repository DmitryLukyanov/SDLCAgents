/**
 * create_github_issue runner.
 *
 * Creates a placeholder GitHub issue for the Jira ticket, labels it with
 * jira:{ISSUE_KEY}, and stores the issue number in the pipeline context
 * for downstream steps (e.g. dispatch_workflow).
 */
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

export async function runCreateGithubIssue(
  ctx: RunnerContext,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo } = ctx;

  console.log(`  Creating GitHub issue for ${issueKey}...`);

  const issueNumber = await deps.createGithubIssue(owner, repo, issueKey);
  ctx.githubIssueNumber = issueNumber;

  console.log(`  ✅ Created GitHub issue #${issueNumber}`);
  return { status: 'continue' };
}
