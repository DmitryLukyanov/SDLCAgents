/**
 * Shared Jira fetch + ticket assembly for Business Analyst steps (inline or Codex).
 */
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import {
  extractComments,
  mapRelated,
} from '../../business-analyst/business-analyst-core.js';
import type { RelatedIssueSummary } from '../../../lib/jira/jira-related.js';
import type { TicketContext } from '../../business-analyst/ba-types.js';
import type { AiTeammateDeps, BaInlineStep, RunnerContext, StepOutcome } from '../runner-types.js';

export type CollectBaTicketContextResult =
  | { kind: 'skip_pipeline'; outcome: StepOutcome }
  | { kind: 'ready'; ticketCtx: TicketContext; step: BaInlineStep };

export async function collectBaTicketContext(
  ctx: RunnerContext,
  step: BaInlineStep,
  deps: AiTeammateDeps,
): Promise<CollectBaTicketContextResult> {
  const { issueKey } = ctx;
  const { skipIfLabel } = step;

  console.log('\n── BA: Fetching Jira data ──');
  const requestFields = ['summary', 'description', 'comment'];
  if (skipIfLabel) requestFields.push('labels');
  const issue = await deps.getIssue(issueKey, requestFields);

  if (skipIfLabel) {
    const existingLabels: string[] = (issue.fields as unknown as Record<string, string[]>)?.labels ?? [];
    if (existingLabels.includes(skipIfLabel)) {
      console.log(`   ⏭️ Skipping BA — ticket already has label "${skipIfLabel}"`);
      return {
        kind: 'skip_pipeline',
        outcome: { status: 'stop', reason: `already labelled "${skipIfLabel}"` },
      };
    }
  }

  const fields = issue.fields;
  const summary = fields?.summary?.trim() || '(no summary)';
  const description = adfToPlain(fields?.description);
  const comments = extractComments(fields);

  const depthRaw = parseInt(process.env['TICKET_CONTEXT_DEPTH'] ?? '1', 10);
  const depth = !Number.isNaN(depthRaw) && depthRaw >= 0 ? depthRaw : 1;

  let related: RelatedIssueSummary[] = [];
  try {
    related = await deps.fetchRelatedIssueSummaries(issueKey, depth);
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

  return { kind: 'ready', ticketCtx, step };
}
