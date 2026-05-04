/**
 * After BA prep artifacts are uploaded: if the agent config defines an `async_call` step and Codex BA
 * should run, dispatch the child workflow and set `dispatched=true`. Otherwise `dispatched=false`.
 *
 * Env: CONFIG_FILE, CALLER_CONFIG, COPILOT_PAT, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID,
 *      GITHUB_REF_NAME, AI_TEAMMATE_CONCURRENCY_KEY, AI_TEAMMATE_SKIP_BA_REASON (empty = run BA),
 *      AI_TEAMMATE_RUN_CODEX (`true` / `false`), AI_TEAMMATE_ENTRY_WORKFLOW_FILE (callback target YAML name; CI sets from
 *      `github.workflow_ref` basename in `_reusable-ai-teammate.yml`).
 *      GITHUB_STEP_SUMMARY (optional): appends a markdown section for async handoff (dispatched or skipped).
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Octokit } from '@octokit/rest';
import { findFirstEnabledAsyncCallStepIndex, parseAgentPipelineSteps } from '../../lib/pipeline-config.js';
import { buildParentRunFields, mergeCallerConfigForAsyncChildDispatch } from '../../lib/pipeline-callback-config.js';
import {
  buildGithubWorkflowDispatchPayload,
  buildAiTeammateWorkflowDispatchInputsWithCaller,
  dispatchGithubWorkflow,
} from '../../lib/routing_helper.js';

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${name}=${value}\n`, 'utf8');
  console.log(`[dispatch-pipeline-async-child] ${name}=${value}`);
}

/** GitHub Actions job summary (`GITHUB_STEP_SUMMARY`); no-op when unset (local runs). */
function appendJobSummary(markdown: string): void {
  const path = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (!path) return;
  appendFileSync(path, `${markdown}\n\n`, 'utf8');
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function maybeParseAsyncHandoffFromOutput(): { triggerStep?: string; workflowFile?: string } {
  const raw = process.env.ASYNC_HANDOFF?.trim() ?? '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { triggerStep?: string; workflowFile?: string };
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    console.warn('[dispatch-pipeline-async-child] ASYNC_HANDOFF is not valid JSON; ignoring.');
    return {};
  }
}

async function main(): Promise<void> {
  const configFile = requireEnv('CONFIG_FILE');
  const callerConfigEncoded = requireEnv('CALLER_CONFIG');
  const runCodex = requireEnv('AI_TEAMMATE_RUN_CODEX') === 'true';
  const concurrencyKey = requireEnv('AI_TEAMMATE_CONCURRENCY_KEY');
  const entryWorkflow = process.env.AI_TEAMMATE_ENTRY_WORKFLOW_FILE?.trim() || 'ai-teammate.yml';

  const handoff = maybeParseAsyncHandoffFromOutput();

  const abs = resolve(process.cwd(), configFile);
  const raw = readFileSync(abs, 'utf8');
  const steps = parseAgentPipelineSteps(raw, configFile);
  const asyncIdx = findFirstEnabledAsyncCallStepIndex(steps);

  if (!runCodex || asyncIdx < 0) {
    setOutput('dispatched', 'false');
    let reason = '';
    if (asyncIdx < 0) {
      reason = 'No enabled step with `async_call` in the agent config.';
      console.log('[dispatch-pipeline-async-child] No enabled step with async_call — not dispatching async child.');
    } else if (!runCodex) {
      reason = 'Codex BA is disabled for this run (`AI_TEAMMATE_RUN_CODEX` is not `true`).';
      console.log('[dispatch-pipeline-async-child] BA skipped or disabled — not dispatching async child.');
    }
    appendJobSummary(
      [
        '### AI Teammate — async handoff',
        '',
        'The pipeline set **async handoff**, but the child workflow was **not** dispatched.',
        '',
        `- **Concurrency key:** \`${concurrencyKey}\``,
        `- **Reason:** ${reason}`,
        '',
        `_Config file:_ \`${configFile}\``,
      ].join('\n'),
    );
    return;
  }

  const step = steps[asyncIdx]!;
  const ac = step.async_call!;
  const workflowFile = ac.workflowFile.trim();
  const ref = (ac.workflowRef?.trim() || requireEnv('GITHUB_REF_NAME')).trim();

  const repoFull = requireEnv('GITHUB_REPOSITORY');
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: ${repoFull}`);

  const parentFields = buildParentRunFields({
    githubServerUrl: requireEnv('GITHUB_SERVER_URL'),
    githubRepository: repoFull,
    githubRunId: requireEnv('GITHUB_RUN_ID'),
  });

  const stepId = handoff.triggerStep?.trim() || (step.id ?? `${step.runner}#${asyncIdx}`);
  const mergedCaller = mergeCallerConfigForAsyncChildDispatch(callerConfigEncoded, {
    callback: entryWorkflow,
    async_trigger_step: stepId,
    ...parentFields,
  });

  const inputs: Record<string, string> = {
    ...buildAiTeammateWorkflowDispatchInputsWithCaller({
      concurrencyKey,
      configFile,
      callerConfigEncoded: mergedCaller,
    }),
  };
  if (ac.inputs) {
    for (const [k, v] of Object.entries(ac.inputs)) {
      if (v !== undefined && v !== null) inputs[k] = String(v);
    }
  }

  const payload = buildGithubWorkflowDispatchPayload({
    owner,
    repo,
    workflowId: workflowFile,
    ref,
    inputs,
  });

  const octokit = new Octokit({ auth: requireEnv('COPILOT_PAT') });
  await dispatchGithubWorkflow(octokit, payload);

  console.log(`[dispatch-pipeline-async-child] Dispatched ${workflowFile}@${ref} for ${concurrencyKey}.`);
  setOutput('dispatched', 'true');

  const parentRunUrl = `${requireEnv('GITHUB_SERVER_URL')}/${repoFull}/actions/runs/${requireEnv('GITHUB_RUN_ID')}`;
  appendJobSummary(
    [
      '### AI Teammate — async handoff',
      '',
      `Dispatched child workflow **\`${workflowFile}\`** on ref **\`${ref}\`** (this parent run will resume after the child completes).`,
      '',
      '| Detail | Value |',
      '| --- | --- |',
      `| Concurrency key | \`${concurrencyKey}\` |`,
      `| Pipeline step (\`async_trigger_step\`) | \`${stepId}\` |`,
      `| Child workflow file | \`${workflowFile}\` |`,
      `| Child dispatch ref | \`${ref}\` |`,
      `| Resume callback (entry workflow) | \`${entryWorkflow}\` |`,
      `| This parent run | [Open in Actions](${parentRunUrl}) |`,
    ].join('\n'),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
