/**
 * Pure helpers for async pipeline handoff via `caller_config` (any agent using `params.steps` + `async_call`).
 * Pair with `pipeline-config.ts` / `pipeline-expected-step-helper.ts` and `routing_helper.buildGithubWorkflowDispatchPayload`.
 */
import { mergeCallerConfigEncoded } from './caller-config.js';

/** Build `parent_run_url` / `parent_run_id` from a GitHub Actions context. */
export function buildParentRunFields(params: {
  githubServerUrl: string;
  githubRepository: string;
  githubRunId: string;
}): { parent_run_url: string; parent_run_id: string } {
  const repo = params.githubRepository.trim();
  const base = params.githubServerUrl.replace(/\/$/, '');
  return {
    parent_run_url: `${base}/${repo}/actions/runs/${params.githubRunId}`,
    parent_run_id: params.githubRunId,
  };
}

/** Merge fields the parent sets when dispatching the async child (child reads these; parent resume uses them too). */
export function mergeCallerConfigForAsyncChildDispatch(
  callerConfigEncoded: string,
  patch: {
    callback: string;
    async_trigger_step: string;
    parent_run_url: string;
    parent_run_id: string;
  },
): string {
  return mergeCallerConfigEncoded(callerConfigEncoded, patch);
}

/** Child → parent callback: record the async child run id on the same encoded payload you will send back to the parent. */
export function mergeCallerConfigForParentResumeAfterAsync(
  callerConfigEncoded: string,
  asyncChildRunId: string,
): string {
  return mergeCallerConfigEncoded(callerConfigEncoded, { async_child_run_id: asyncChildRunId });
}
