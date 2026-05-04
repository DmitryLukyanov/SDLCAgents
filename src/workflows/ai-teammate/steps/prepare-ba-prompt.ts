/**
 * Sync pipeline step: prepare input artifacts for the async BA step.
 *
 * Reads Jira data, builds the LLM prompt, and writes all input artifacts to the
 * handoff workspace so the async boundary step can upload them as-is.
 * Also writes ba-codex-state.json (githubIssueNumber, ticketCtx) for the resume run.
 *
 * Artifact paths come from the contract on the first async_call step in the config.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getBaAnalysisSystemPrompt, buildBaTicketPrompt } from '../../business-analyst/analyze-ticket.js';
import {
  handoffWorkspacePaths,
  loadAgentInvocationContractFromConfigFile,
  writeInvocationHandoffManifestFile,
} from '../../../lib/agent-invocation-contract.js';
import { fillTemplate, loadTemplate } from '../../../lib/template-utils.js';
import { collectCodexBaTicketContextFromJira } from './collect-codex-ba-ticket-context-from-jira.js';
import { STATE_VERSION } from '../ai-teammate-codex-ba-shared.js';
import type { BaCodexStateFile } from '../ai-teammate-codex-ba-shared.js';
import type { AiTeammateDeps, PipelineStep, RunnerContext, StepOutcome } from '../runner-types.js';

const BA_STARTED = loadTemplate(import.meta.url, '..', 'templates', 'ba-started.md');

export async function runPrepareBaPrompt(
  ctx: RunnerContext,
  _step: PipelineStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const skipBa = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';
  if (skipBa) {
    console.log(`   ⏭ Skipped — BA segment gated (${skipBa})`);
    return { status: 'continue' };
  }

  const agentLabelParams = ctx.agentLabelParams ?? {};
  const contract = loadAgentInvocationContractFromConfigFile(ctx.configFile);
  const p = handoffWorkspacePaths(ctx.issueKey, contract);
  mkdirSync(p.base, { recursive: true });

  if (ctx.githubIssueNumber) {
    await deps
      .addGithubIssueComment(
        ctx.owner,
        ctx.repo,
        ctx.githubIssueNumber,
        fillTemplate(BA_STARTED, { ISSUE_KEY: ctx.issueKey }),
      )
      .catch(() => { /* non-fatal */ });
  }

  const { ticketCtx } = await collectCodexBaTicketContextFromJira(ctx, agentLabelParams, deps);

  const system = getBaAnalysisSystemPrompt();
  const ticketBlock = buildBaTicketPrompt(ticketCtx);
  const promptBody = [
    system,
    '',
    '---',
    '',
    '## Jira ticket and context',
    '',
    ticketBlock,
    '',
    '---',
    '',
    'Respond with ONLY a single JSON object (no markdown code fences) with exactly these keys: ' +
      '"specifyInput","clarifyInput","planInput","tasksInput","implementInput". ' +
      'Each value must be a string or null. Follow every rule from the system instructions above.',
  ].join('\n');

  const promptPath = p.inputPaths['prompt'];
  const jiraContextPath = p.inputPaths['jiraContext'];
  if (!promptPath || !jiraContextPath) {
    throw new Error(
      '[prepare_ba_prompt] contract.inputParams must define "prompt" and "jiraContext" artifact refs',
    );
  }

  writeFileSync(promptPath, promptBody + '\n', 'utf8');
  writeFileSync(jiraContextPath, `# Ticket context (invocation handoff artifact)\n\n${ticketBlock}\n`, 'utf8');

  const state: BaCodexStateFile = {
    version: STATE_VERSION,
    ticketCtx,
    agentLabelParams,
    runnerCtx: {
      issueKey: ctx.issueKey,
      owner: ctx.owner,
      repo: ctx.repo,
      ref: ctx.ref,
      callerConfig: ctx.callerConfig,
      configFile: ctx.configFile,
      githubIssueNumber: ctx.githubIssueNumber,
    },
    codexRelativeOutputPath: p.codexRelativeOutputPath,
  };

  writeFileSync(p.state, JSON.stringify(state, null, 2) + '\n', 'utf8');
  writeInvocationHandoffManifestFile(p.base, contract);

  console.log(`[prepare_ba_prompt] Wrote artifacts to ${p.base}`);
  return { status: 'continue' };
}
