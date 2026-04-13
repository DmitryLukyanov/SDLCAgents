/**
 * run_ba_inline runner.
 *
 * Runs Business Analyst analysis inline (no separate workflow dispatch).
 * Fetches Jira data + related issues, runs LLM analysis, and stores the outcome.
 *
 *   Complete   → stores outcome in ctx → pipeline continues to assign_copilot
 *   Incomplete → posts questions to Jira, closes GitHub issue, transitions to Blocked → stops pipeline
 */
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import { loadTemplate, fillTemplate } from '../../../lib/template-utils.js';
import {
  extractComments,
  mapRelated,
} from '../../business-analyst/business-analyst-core.js';
import type { RelatedIssueSummary } from '../../../lib/jira/jira-related.js';
import type { TicketContext } from '../../business-analyst/ba-types.js';
import type { AiTeammateDeps, BaInlineStep, RunnerContext, StepOutcome } from '../runner-types.js';

const BA_STARTED    = loadTemplate(import.meta.url, '..', 'templates', 'ba-started.md');
const BA_COMPLETE   = loadTemplate(import.meta.url, '..', 'templates', 'ba-complete.md');
const BA_INCOMPLETE = loadTemplate(import.meta.url, '..', 'templates', 'ba-incomplete.md');

export async function runBaInline(
  ctx: RunnerContext,
  step: BaInlineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey } = ctx;
  const { skipIfLabel, addLabel } = step;

  // ── Fetch Jira data ──────────────────────────────────────────────
  console.log('\n── BA: Fetching Jira data ──');
  const requestFields = ['summary', 'description', 'comment'];
  if (skipIfLabel) requestFields.push('labels');
  const issue = await deps.getIssue(issueKey, requestFields);

  // ── Skip if already labelled ─────────────────────────────────────
  if (skipIfLabel) {
    const existingLabels: string[] = (issue.fields as unknown as Record<string, string[]>)?.labels ?? [];
    if (existingLabels.includes(skipIfLabel)) {
      console.log(`   ⏭️ Skipping BA — ticket already has label "${skipIfLabel}"`);
      return { status: 'stop', reason: `already labelled "${skipIfLabel}"` };
    }
  }
  const fields = issue.fields;
  const summary = fields?.summary?.trim() || '(no summary)';
  const description = adfToPlain(fields?.description);
  const comments = extractComments(fields);

  // ── Fetch related issues ─────────────────────────────────────────
  let related: RelatedIssueSummary[] = [];
  try {
    related = await deps.fetchRelatedIssueSummaries(issueKey, 1);
  } catch (e) {
    console.warn('   ⚠️ Could not fetch related issues (non-fatal):', e);
  }

  const ticketCtx: TicketContext = {
    issueKey,
    summary,
    description,
    comments,
    relatedIssues: mapRelated(related),
  };

  // ── Analyze with LLM ────────────────────────────────────────────
  console.log('\n── BA: Analyzing ticket via GitHub Models API ──');

  if (ctx.githubIssueNumber) {
    await deps.addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber,
      fillTemplate(BA_STARTED, { ISSUE_KEY: issueKey })
    ).catch(() => { /* non-fatal */ });
  }

  const outcome = await deps.analyzeTicket(ticketCtx, deps.githubToken, deps.model);

  if (outcome.status === 'complete') {
    console.log('   ✅ BA analysis complete — all 5 fields extracted');
    ctx.baOutcome = outcome;

    if (addLabel) {
      await deps.addJiraIssueLabel(issueKey, addLabel).catch((e) => {
        console.warn(`   ⚠️ Could not add label "${addLabel}" to Jira (non-fatal):`, e);
      });
    }

    if (ctx.githubIssueNumber) {
      await deps.addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber,
        fillTemplate(BA_COMPLETE, { ISSUE_KEY: issueKey })
      ).catch(() => { /* non-fatal */ });
    }

    return { status: 'continue' };
  }

  // ── Incomplete: block ticket + close GitHub issue ────────────────
  console.log('\n── BA: Analysis incomplete — blocking ticket ──');

  try {
    await deps.addIssueComment(issueKey, outcome.questions);
    console.log('   ✅ Posted questions to Jira');
  } catch (e) {
    console.error('   ❌ Failed to post questions to Jira:', e);
  }

  if (ctx.githubIssueNumber) {
    try {
      await deps.addGithubIssueComment(ctx.owner, ctx.repo, ctx.githubIssueNumber,
        fillTemplate(BA_INCOMPLETE, { ISSUE_KEY: issueKey })
      ).catch(() => { /* non-fatal */ });
      await deps.closeGithubIssue(ctx.owner, ctx.repo, ctx.githubIssueNumber);
      console.log(`   ✅ Closed placeholder GitHub issue #${ctx.githubIssueNumber}`);
    } catch (e) {
      console.warn('   ⚠️ Could not close GitHub issue (non-fatal):', e);
    }
  }

  return { status: 'stop', reason: 'BA analysis incomplete — questions posted, ticket blocked' };
}
