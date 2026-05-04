/**
 * Codex BA — prepare (no LLM): GitHub issue checkpoint, BA prompt, `ba-codex-state.json`.
 *
 * Modes: `codex_ba_create_github_issue`, `codex_ba_prepare_prompt`, `codex_ba_prepare` (both phases).
 * Skip-by-label is handled in CI (`evaluateSkipIfLabel` in `lib/agent-skip-if-label.ts`; entry: `check-ba-skip-label-ci.ts`) before `codex_ba_prepare_prompt`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import { getBaAnalysisSystemPrompt, buildBaTicketPrompt } from '../business-analyst/analyze-ticket.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
import { runPipelineThroughInclusive, type StepRecord } from './ai-teammate-pipeline.js';
import { collectCodexBaTicketContextFromJira } from './steps/collect-codex-ba-ticket-context-from-jira.js';
import type { AgentLabelParams, AiTeammateDeps, PipelineStep, RunnerContext } from './runner-types.js';
import {
  assertBaCodexPrepareContract,
  handoffWorkspacePaths,
  loadAgentInvocationContractFromConfigFile,
} from '../../lib/agent-invocation-contract.js';
import {
  GITHUB_ISSUE_PREP_VERSION,
  STATE_VERSION,
  assertConcurrencyKeyMatchesIssue,
  loadHandoffPathsFromConfig,
  type BaCodexStateFile,
  type BaGithubIssuePrepFile,
} from './ai-teammate-codex-ba-shared.js';

const BA_STARTED = loadTemplate(import.meta.url, 'templates', 'ba-started.md');

async function requireCodexBaPipelineContext(): Promise<{
  issueKey: string;
  steps: PipelineStep[];
  agentLabelParams: AgentLabelParams;
  ctxInit: Omit<RunnerContext, 'issueKey' | 'githubIssueNumber' | 'baOutcome'>;
}> {
  const { issueKey, steps, ctxInit, runner, agentLabelParams } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);
  if (runner !== 'pipeline') {
    throw new Error('Codex BA prepare phases require params.runner "pipeline"');
  }
  return { issueKey, steps, agentLabelParams, ctxInit };
}

/** Persist checkpoint after `create_github_issue` for `codex_ba_prepare_prompt` / async BA handoff. */
export function writeBaGithubIssuePrepCheckpoint(
  issueKey: string,
  ctx: RunnerContext,
  records: StepRecord[],
): void {
  const p = loadHandoffPathsFromConfig(issueKey);
  mkdirSync(p.base, { recursive: true });

  const prep: BaGithubIssuePrepFile = {
    version: GITHUB_ISSUE_PREP_VERSION,
    partialRecords: records,
    runnerCtx: {
      issueKey: ctx.issueKey,
      owner: ctx.owner,
      repo: ctx.repo,
      ref: ctx.ref,
      callerConfig: ctx.callerConfig,
      configFile: ctx.configFile,
      githubIssueNumber: ctx.githubIssueNumber,
    },
  };

  writeFileSync(p.githubIssuePrep, JSON.stringify(prep, null, 2) + '\n', 'utf8');
  console.log(`[codex-ba-github-issue] Wrote ${p.githubIssuePrep} (GitHub issue #${ctx.githubIssueNumber ?? '?'})`);
}

/** Pipeline through `create_github_issue`; persists `ba-github-issue-prep.json` for `codex_ba_prepare_prompt`. */
export async function runCodexBaCreateGithubIssuePhase(deps: AiTeammateDeps): Promise<void> {
  const { issueKey, steps, ctxInit } = await requireCodexBaPipelineContext();

  const { ctx, records } = await runPipelineThroughInclusive(
    issueKey,
    steps,
    deps,
    ctxInit,
    'create_github_issue',
  );

  writeBaGithubIssuePrepCheckpoint(issueKey, ctx, records);
}

/** After `codex_ba_create_github_issue`; writes BA Codex prompt + `ba-codex-state.json`. */
export async function runCodexBaPreparePromptPhase(deps: AiTeammateDeps): Promise<void> {
  const { issueKey, steps, agentLabelParams } = await requireCodexBaPipelineContext();
  const configFile = process.env.CONFIG_FILE?.trim();
  if (!configFile) throw new Error('CONFIG_FILE is required for codex_ba_prepare_prompt');
  const contract = loadAgentInvocationContractFromConfigFile(resolve(process.cwd(), configFile));
  assertBaCodexPrepareContract(contract);
  const p = handoffWorkspacePaths(issueKey, contract);

  if (!existsSync(p.githubIssuePrep)) {
    throw new Error(
      `[codex_ba_prepare_prompt] Missing ${p.githubIssuePrep} — run codex_ba_create_github_issue first (same job or prior step).`,
    );
  }

  const prep = JSON.parse(readFileSync(p.githubIssuePrep, 'utf8')) as BaGithubIssuePrepFile;
  if (prep.version !== GITHUB_ISSUE_PREP_VERSION) {
    throw new Error(`[codex_ba_prepare_prompt] Unsupported ba-github-issue-prep.json version: ${prep.version}`);
  }
  if (prep.runnerCtx.issueKey !== issueKey) {
    throw new Error(
      `[codex_ba_prepare_prompt] Checkpoint issueKey "${prep.runnerCtx.issueKey}" does not match CONFIG/CALLER_CONFIG "${issueKey}".`,
    );
  }

  const ctx: RunnerContext = {
    ...prep.runnerCtx,
    baOutcome: undefined,
  };
  const records = prep.partialRecords;

  const { ticketCtx } = await collectCodexBaTicketContextFromJira(ctx, agentLabelParams, deps);
  mkdirSync(p.base, { recursive: true });

  if (ctx.githubIssueNumber) {
    await deps
      .addGithubIssueComment(
        ctx.owner,
        ctx.repo,
        ctx.githubIssueNumber,
        fillTemplate(BA_STARTED, { ISSUE_KEY: ctx.issueKey }),
      )
      .catch(() => {
        /* non-fatal */
      });
  }

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
    throw new Error('[codex_ba_prepare_prompt] contract must define inputParams.prompt and inputParams.jiraContext');
  }

  writeFileSync(promptPath, promptBody + '\n', 'utf8');

  const jiraHandoffBody = ['# Ticket context (invocation handoff artifact)', '', ticketBlock, ''].join('\n');
  writeFileSync(jiraContextPath, jiraHandoffBody + '\n', 'utf8');

  const codexRelativeOutputPath = p.codexRelativeOutputPath;

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
    codexRelativeOutputPath,
    partialRecords: records,
  };

  writeFileSync(p.state, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log(
    `[codex-ba-prepare-prompt] Wrote ${promptPath}, ${jiraContextPath}, ${p.state} (Codex output → ${codexRelativeOutputPath})`,
  );
}

/** Runs GitHub-issue phase then BA prompt phase (same as two dedicated workflow steps). */
export async function runCodexBaPrepare(deps: AiTeammateDeps): Promise<void> {
  await runCodexBaCreateGithubIssuePhase(deps);
  await runCodexBaPreparePromptPhase(deps);
}
