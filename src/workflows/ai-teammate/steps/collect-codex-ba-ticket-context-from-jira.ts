/**
 * During pipeline async handoff: load Jira issue + related
 * issues and assemble {@link TicketContext} for the Codex BA prompt / invocation handoff files.
 */
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import {
  extractComments,
  mapRelated,
} from '../../business-analyst/business-analyst-core.js';
import type { RelatedIssueSummary } from '../../../lib/jira/jira-related.js';
import type { TicketContext } from '../../business-analyst/ba-types.js';
import type { AgentLabelParams, AiTeammateDeps, RunnerContext } from '../runner-types.js';

/** Jira snapshot + label params carried into `ba-codex-state.json` for finish (`params.skipIfLabel` enforced in CI — see `lib/agent-skip-if-label.ts`). */
export interface CodexBaTicketContextBundle {
  ticketCtx: TicketContext;
  agentLabelParams: AgentLabelParams;
}

export async function collectCodexBaTicketContextFromJira(
  ctx: RunnerContext,
  agentLabelParams: AgentLabelParams,
  deps: AiTeammateDeps,
): Promise<CodexBaTicketContextBundle> {
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

  return { ticketCtx, agentLabelParams };
}
