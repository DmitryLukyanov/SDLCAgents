/**
 * Sync pipeline step: read BA output artifact and apply the result to Jira + GitHub.
 *
 * Runs after the async boundary step on the resume invocation.
 * Reads ba-codex-state.json (written by prepare_ba_prompt, downloaded on resume)
 * to recover githubIssueNumber and ticketCtx, then reads the Codex output artifact
 * and applies the BA result.
 *
 * Mutates ctx.githubIssueNumber and ctx.baOutcome so subsequent steps (e.g. start_developer_agent)
 * see the correct values.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interpretBaModelOutput } from '../../business-analyst/analyze-ticket.js';
import { codexBaPaths } from '../ai-teammate-codex-ba-shared.js';
import type { BaCodexStateFile } from '../ai-teammate-codex-ba-shared.js';
import { STATE_VERSION } from '../ai-teammate-codex-ba-shared.js';
import { applyCodexBaOutcomeToJiraAndGithub } from './apply-codex-ba-outcome-to-jira-github.js';
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from '../runner-types.js';

export async function runApplyBaOutcome(
  ctx: RunnerContext,
  _step: PipelineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const skipBa = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? ctx.skipBaReason ?? '';
  if (skipBa) {
    console.log(`   ⏭ Skipped — BA segment gated (${skipBa})`);
    return { status: 'continue' };
  }

  const p = codexBaPaths(ctx.issueKey);

  if (!existsSync(p.state)) {
    throw new Error(`[apply_ba_outcome] Missing state file: ${p.state}. Was prepare_ba_prompt skipped?`);
  }

  const raw = JSON.parse(readFileSync(p.state, 'utf8')) as BaCodexStateFile;
  if (raw.version !== STATE_VERSION) {
    throw new Error(`[apply_ba_outcome] Unsupported ba-codex-state.json version: ${String(raw.version)}`);
  }

  // Restore resume state into ctx so subsequent steps have the correct issue number and outcome.
  ctx.githubIssueNumber = raw.runnerCtx.githubIssueNumber;

  const agentLabelParams = raw.agentLabelParams ?? ctx.agentLabelParams ?? {};

  const outAbs = join(process.cwd(), raw.codexRelativeOutputPath);
  let codexOutput = '';
  try {
    codexOutput = readFileSync(outAbs, 'utf8');
  } catch {
    console.warn(`[apply_ba_outcome] Missing or unreadable Codex output: ${outAbs}`);
  }

  console.log('\n── BA: Interpreting Codex output ──');
  const outcome = interpretBaModelOutput(codexOutput, raw.ticketCtx);
  ctx.baOutcome = outcome;

  return applyCodexBaOutcomeToJiraAndGithub(ctx, agentLabelParams, deps, outcome);
}
