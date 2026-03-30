/**
 * ensure_jira_fields_expected runner.
 *
 * Fetches the Jira issue and checks whether it has a non-empty description.
 *   - Present  → returns { status: 'continue' }
 *   - Absent   → performs the configured onEmpty action and returns { status: 'stop' }
 *
 * Supported onEmpty actions:
 *   jira_transition — transitions the ticket to a target status and posts a comment.
 */
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

export interface CheckDescriptionOnEmpty {
  action: 'jira_transition';
  /** Target Jira status name (case-insensitive match), e.g. "In Review". */
  status: string;
  /** Plain-text comment posted to the ticket. */
  comment: string;
}

export interface CheckDescriptionStep {
  runner: 'ensure_jira_fields_expected';
  onEmpty: CheckDescriptionOnEmpty;
}

export async function runEnsureJiraFieldsExpected(
  ctx: RunnerContext,
  config: CheckDescriptionStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  console.log(`  Fetching description for ${ctx.issueKey}...`);
  const issue = await deps.getIssue(ctx.issueKey, ['summary', 'description']);
  const description = adfToPlain(issue.fields?.description).trim();

  if (description) {
    console.log(`  ✅ Description present — continuing pipeline.`);
    return { status: 'continue' };
  }

  console.log(`  ⚠️ No description found for ${ctx.issueKey}.`);

  if (config.onEmpty.action === 'jira_transition') {
    await deps.transitionIssueToStatusName(ctx.issueKey, config.onEmpty.status);
    console.log(`  → Transitioned ${ctx.issueKey} to "${config.onEmpty.status}".`);

    await deps.addIssueComment(ctx.issueKey, config.onEmpty.comment);
    console.log(`  → Comment added: "${config.onEmpty.comment}"`);
  }

  return {
    status: 'stop',
    reason: `No description — transitioned ${ctx.issueKey} to "${config.onEmpty.status}"`,
  };
}
