/**
 * After BA prep artifacts are uploaded: if the agent config defines an `async_call` step and Codex BA
 * should run, dispatch the child workflow and set `dispatched=true`. Otherwise `dispatched=false`.
 *
 * Env: CONFIG_FILE, CALLER_CONFIG, COPILOT_PAT, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID,
 *      GITHUB_REF_NAME, AI_TEAMMATE_CONCURRENCY_KEY, AI_TEAMMATE_SKIP_BA_REASON (empty = run BA),
 *      AI_TEAMMATE_RUN_CODEX (`true` / `false`), AI_TEAMMATE_ENTRY_WORKFLOW_FILE (callback target YAML name; CI sets from
 *      `github.workflow_ref` basename in `_reusable-ai-teammate.yml`).
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

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const configFile = requireEnv('CONFIG_FILE');
  const callerConfigEncoded = requireEnv('CALLER_CONFIG');
  const skipReason = process.env.AI_TEAMMATE_SKIP_BA_REASON?.trim() ?? '';
  const runCodex = requireEnv('AI_TEAMMATE_RUN_CODEX') === 'true';
  const concurrencyKey = requireEnv('AI_TEAMMATE_CONCURRENCY_KEY');
  const entryWorkflow = process.env.AI_TEAMMATE_ENTRY_WORKFLOW_FILE?.trim() || 'ai-teammate.yml';

  const abs = resolve(process.cwd(), configFile);
  const raw = readFileSync(abs, 'utf8');
  const steps = parseAgentPipelineSteps(raw, configFile);
  const asyncIdx = findFirstEnabledAsyncCallStepIndex(steps);

  if (!runCodex || skipReason || asyncIdx < 0) {
    setOutput('dispatched', 'false');
    if (asyncIdx < 0) {
      console.log('[dispatch-pipeline-async-child] No enabled step with async_call — not dispatching async child.');
    } else if (!runCodex || skipReason) {
      console.log('[dispatch-pipeline-async-child] BA skipped or disabled — not dispatching async child.');
    }
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

  const stepId = step.id ?? `${step.runner}#${asyncIdx}`;
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
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
