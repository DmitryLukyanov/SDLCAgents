/**
 * CI entry (async child workflow last step): merge `async_child_run_id` into `caller_config`, read
 * `params.callback` as the parent workflow filename, then {@link buildGithubWorkflowDispatchPayload} +
 * {@link dispatchGithubWorkflow} with Octokit.
 *
 * Env (required unless noted):
 *   CALLER_CONFIG        — URL-encoded JSON (from workflow input; includes callback, parent_run_id, …)
 *   CONFIG_FILE          — agent config path (same as parent)
 *   CONCURRENCY_KEY      — same as parent workflow_dispatch input
 *   COPILOT_PAT          — token with actions:write
 *   GITHUB_REPOSITORY    — owner/repo
 *   GITHUB_RUN_ID        — this (child) run id → merged into caller_config as async_child_run_id
 *   GITHUB_REF_NAME      — ref for dispatching the parent (default branch of callback run)
 */
import { Octokit } from '@octokit/rest';
import { decodeCallerConfig } from './caller-config.js';
import { mergeCallerConfigForParentResumeAfterAsync } from './pipeline-callback-config.js';
import {
  buildGithubWorkflowDispatchPayload,
  buildAiTeammateWorkflowDispatchInputsWithCaller,
  dispatchGithubWorkflow,
} from './routing_helper.js';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const callerEncoded = requireEnv('CALLER_CONFIG');
  const runId = requireEnv('GITHUB_RUN_ID');
  const mergedCaller = mergeCallerConfigForParentResumeAfterAsync(callerEncoded, runId);

  const root = decodeCallerConfig(mergedCaller);
  const callbackWf = root.params?.callback?.trim();
  if (!callbackWf) {
    throw new Error('caller_config.params.callback must name the parent entry workflow (e.g. ai-teammate.yml)');
  }

  const repoFull = requireEnv('GITHUB_REPOSITORY');
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: ${repoFull}`);

  const ref = requireEnv('GITHUB_REF_NAME');
  const inputs = buildAiTeammateWorkflowDispatchInputsWithCaller({
    concurrencyKey: requireEnv('CONCURRENCY_KEY'),
    configFile: requireEnv('CONFIG_FILE'),
    callerConfigEncoded: mergedCaller,
  });

  const payload = buildGithubWorkflowDispatchPayload({
    owner,
    repo,
    workflowId: callbackWf,
    ref,
    inputs,
  });

  const octokit = new Octokit({ auth: requireEnv('COPILOT_PAT') });
  await dispatchGithubWorkflow(octokit, payload);

  console.log(`[dispatch-parent-callback] Dispatched ${callbackWf}@${ref} for ${inputs.concurrency_key}.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
