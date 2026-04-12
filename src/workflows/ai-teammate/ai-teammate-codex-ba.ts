/**
 * Codex-based Business Analyst for AI Teammate (GitHub Actions).
 *
 * - `codex_ba_prepare`: run pipeline through `create_github_issue`, write BA prompt + state under `spec-output/<KEY>/`.
 * - Workflow job `ba_codex` runs `openai/codex-action@v1` (writes `ba-codex-output.txt`).
 * - `codex_ba_finish`: parse Codex output, apply BA outcome, run `start_developer_agent`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import {
  getBaAnalysisSystemPrompt,
  buildBaTicketPrompt,
  interpretBaModelOutput,
} from '../business-analyst/analyze-ticket.js';
import { loadAiTeammatePipelineFromEnv } from './ai-teammate-core.js';
import {
  runPipelineThroughInclusive,
  runPipelineFromRunner,
  writeAiTeammatePipelineSummary,
  type StepRecord,
} from './ai-teammate-pipeline.js';
import { collectBaTicketContext } from './steps/ba-collect-ticket-context.js';
import { applyBaOutcome } from './steps/ba-apply-outcome.js';
import type { TicketContext } from '../business-analyst/ba-types.js';
import type { AiTeammateDeps, BaInlineStep, RunnerContext } from './runner-types.js';

const STATE_VERSION = 1 as const;
const BA_STARTED = loadTemplate(import.meta.url, 'templates', 'ba-started.md');

/**
 * `workflow_call` passes `concurrency_key` for artifact paths; `ENCODED_CONFIG` carries the real Jira key.
 * They must match or prepare writes under one path while the workflow looks under another.
 */
function assertConcurrencyKeyMatchesIssue(issueKey: string): void {
  const w = process.env['AI_TEAMMATE_CONCURRENCY_KEY']?.trim();
  if (!w) return;
  if (w !== issueKey) {
    throw new Error(
      `AI Teammate concurrency_key mismatch: workflow input is "${w}" but ENCODED_CONFIG resolves to "${issueKey}". ` +
      'Use the same Jira issue key for `concurrency_key` and inside `encoded_config`.',
    );
  }
}

interface BaCodexSkipFile {
  halt: true;
  reason: string;
}

interface BaCodexStateFile {
  version: typeof STATE_VERSION;
  ticketCtx: TicketContext;
  baStep: BaInlineStep;
  runnerCtx: Pick<
    RunnerContext,
    'issueKey' | 'owner' | 'repo' | 'ref' | 'encodedConfig' | 'configFile' | 'githubIssueNumber' | 'specKitContextFile'
  >;
  /** Path relative to repository root for Codex `output-file` */
  codexRelativeOutputPath: string;
  partialRecords: StepRecord[];
}

function specDir(issueKey: string): string {
  return join(process.cwd(), 'spec-output', issueKey);
}

function paths(issueKey: string) {
  const base = specDir(issueKey);
  return {
    base,
    skip: join(base, 'ba-codex-skip.json'),
    state: join(base, 'ba-codex-state.json'),
    prompt: join(base, 'ba-codex-prompt.md'),
  };
}

export async function runCodexBaPrepare(deps: AiTeammateDeps): Promise<void> {
  const { issueKey, steps, ctxInit, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);
  if (runner !== 'pipeline') {
    throw new Error('codex_ba_prepare requires params.runner "pipeline"');
  }

  const baStep = steps.find(s => s.runner === 'run_ba_inline') as BaInlineStep | undefined;
  if (!baStep) {
    throw new Error('codex_ba_prepare: no run_ba_inline step in pipeline config');
  }

  const { ctx, records } = await runPipelineThroughInclusive(
    issueKey,
    steps,
    deps,
    ctxInit,
    'create_github_issue',
  );

  const collected = await collectBaTicketContext(ctx, baStep, deps);
  if (collected.kind === 'skip_pipeline') {
    const p = paths(issueKey);
    mkdirSync(p.base, { recursive: true });
    const skipReason =
      collected.outcome.status === 'stop' ? collected.outcome.reason : 'skipped';
    const skip: BaCodexSkipFile = {
      halt: true,
      reason: skipReason,
    };
    writeFileSync(p.skip, JSON.stringify(skip, null, 2) + '\n', 'utf8');
    console.log(`[codex-ba-prepare] Wrote skip file (${skip.reason}) — Codex BA job will be skipped.`);
    return;
  }

  const { ticketCtx } = collected;
  const p = paths(issueKey);
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

  writeFileSync(p.prompt, promptBody + '\n', 'utf8');

  const codexRelativeOutputPath = join('spec-output', issueKey, 'ba-codex-output.txt').replace(/\\/g, '/');

  const state: BaCodexStateFile = {
    version: STATE_VERSION,
    ticketCtx,
    baStep,
    runnerCtx: {
      issueKey: ctx.issueKey,
      owner: ctx.owner,
      repo: ctx.repo,
      ref: ctx.ref,
      encodedConfig: ctx.encodedConfig,
      configFile: ctx.configFile,
      githubIssueNumber: ctx.githubIssueNumber,
      specKitContextFile: ctx.specKitContextFile,
    },
    codexRelativeOutputPath,
    partialRecords: records,
  };

  writeFileSync(p.state, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log(`[codex-ba-prepare] Wrote ${p.prompt} and ${p.state} (Codex output → ${codexRelativeOutputPath})`);
}

export async function runCodexBaFinish(deps: AiTeammateDeps): Promise<void> {
  const { issueKey, steps, runner } = await loadAiTeammatePipelineFromEnv();
  assertConcurrencyKeyMatchesIssue(issueKey);
  if (runner !== 'pipeline') {
    throw new Error('codex_ba_finish requires params.runner "pipeline"');
  }

  const p = paths(issueKey);

  if (existsSync(p.skip)) {
    const skip = JSON.parse(readFileSync(p.skip, 'utf8')) as BaCodexSkipFile;
    console.log(`[codex-ba-finish] Skip file present — ${skip.reason}`);
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      await appendFile(
        summaryPath,
        `\n## Codex BA skipped\n\n**${issueKey}** — ${skip.reason}\n`,
      );
    }
    return;
  }

  if (!existsSync(p.state)) {
    throw new Error(`[codex-ba-finish] Missing state file: ${p.state}`);
  }

  const state = JSON.parse(readFileSync(p.state, 'utf8')) as BaCodexStateFile;
  if (state.version !== STATE_VERSION) {
    throw new Error(`[codex-ba-finish] Unsupported ba-codex-state.json version: ${state.version}`);
  }

  const outAbs = join(process.cwd(), state.codexRelativeOutputPath);
  let raw = '';
  try {
    raw = readFileSync(outAbs, 'utf8');
  } catch {
    console.warn(`[codex-ba-finish] Missing or unreadable Codex output: ${outAbs}`);
  }

  const ctx: RunnerContext = {
    ...state.runnerCtx,
    baOutcome: undefined,
  };

  const baStep = state.baStep;
  console.log('\n── BA: Interpreting Codex output ──');
  const outcome = interpretBaModelOutput(raw, state.ticketCtx);
  ctx.baOutcome = outcome;

  const stepOutcome = await applyBaOutcome(ctx, baStep, deps, outcome);

  const inlineRecord: StepRecord = {
    runner: 'run_ba_inline',
    status: stepOutcome.status,
    reason: stepOutcome.status === 'stop' ? stepOutcome.reason : undefined,
    durationMs: 0,
  };

  if (stepOutcome.status === 'stop') {
    await writeAiTeammatePipelineSummary(
      issueKey,
      `${ctx.owner}/${ctx.repo}`,
      [...state.partialRecords, inlineRecord],
      ctx,
    );
    return;
  }

  await runPipelineFromRunner(
    issueKey,
    steps,
    'start_developer_agent',
    deps,
    ctx,
    [...state.partialRecords, inlineRecord],
  );
}
