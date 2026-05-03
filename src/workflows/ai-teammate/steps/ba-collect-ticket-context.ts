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
import type { AiTeammateDeps, BaInlineStep, RunnerContext } from '../runner-types.js';

/** Jira snapshot for BA prompt building (`run_ba_inline.skipIfLabel` is enforced in CI — see `check-ba-skip-label-ci.ts`). */
export interface BaTicketContextBundle {
  ticketCtx: TicketContext;
  step: BaInlineStep;
}

export async function collectBaTicketContext(
  ctx: RunnerContext,
  step: BaInlineStep,
  deps: AiTeammateDeps,
): Promise<BaTicketContextBundle> {
  const { issueKey } = ctx;

  console.log('\n── BA: Fetching Jira data ──');
  const issue = await deps.getIssue(issueKey, ['summary', 'description', 'comment']);

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

  return { ticketCtx, step };
}
