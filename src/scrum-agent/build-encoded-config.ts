/**
 * Builds encoded_config for workflow_dispatch (Scrum Master → ai-teammate).
 */
import type { EncodedConfigParams } from '../lib/encoded-config.js';

export function buildEncodedConfig(ticketKey: string): string {
  const customParams: Record<string, string> = {};
  const taken = process.env.REQUIRED_JIRA_STATUS?.trim();
  const move = process.env.POST_READ_STATUS?.trim();
  if (taken) customParams.taken_status = taken;
  if (move) customParams.status_to_move_to = move;
  const ctx = process.env.TICKET_CONTEXT_DEPTH?.trim() || '1';
  customParams.ticket_context_depth = ctx;

  const params: EncodedConfigParams = {
    inputJql: `key = ${ticketKey}`,
  };
  if (Object.keys(customParams).length > 0) {
    params.customParams = customParams;
  }

  return encodeURIComponent(JSON.stringify({ params }));
}
