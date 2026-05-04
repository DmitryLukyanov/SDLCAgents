/**
 * start_developer_agent async handoff runner.
 *
 * Reuses the **same async pipeline flow** as `ba_async`:
 * - prepare phase writes artifacts/state under `async-invocation-handoff/<issueKey>/`
 * - a child workflow (from `async_call.workflowFile`) reads the manifest + artifacts and performs side effects
 * - parent resumes after child and continues the pipeline
 *
 * This file contains only the prepare-phase logic; it does not depend on any ai-teammate callbacks.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { AiTeammateDeps, RunnerContext } from '../runner-types.js';
import {
  assertGenericAsyncStepContract,
  handoffWorkspacePaths,
  writeInvocationHandoffManifestFile,
} from '../../../lib/agent-invocation-contract.js';
import { loadHandoffPathsFromConfig } from '../ai-teammate-codex-ba-shared.js';
import { prepareStartDeveloperAgentAsync } from './start-developer-agent.js';

export const START_DEVELOPER_AGENT_ASYNC_STATE_VERSION = 1 as const;

export interface StartDeveloperAgentAsyncStateFile {
  version: typeof START_DEVELOPER_AGENT_ASYNC_STATE_VERSION;
  runnerCtx: {
    issueKey: string;
    owner: string;
    repo: string;
    ref: string;
    callerConfig: string;
    configFile: string;
    githubIssueNumber: number;
  };
}

/**
 * Prepare artifacts for the async child workflow.
 *
 * - `contract.inputParams.issueBody` receives the fully rendered GitHub issue body.
 * - `contract.inputParams.dispatchInputs` receives JSON with workflow dispatch inputs.
 */
export async function prepareStartDeveloperAgentArtifacts(
  ctx: RunnerContext,
  step: { runner: 'start_developer_agent_async'; workflowFile?: string; contract?: unknown },
  deps: AiTeammateDeps,
): Promise<void> {
  const pState = loadHandoffPathsFromConfig(ctx.issueKey);
  const contract = assertGenericAsyncStepContract(step);
  const p = handoffWorkspacePaths(ctx.issueKey, contract);
  mkdirSync(p.base, { recursive: true });

  const prepared = await prepareStartDeveloperAgentAsync(
    ctx,
    { runner: 'start_developer_agent', workflowFile: step.workflowFile },
    deps,
  );

  const issueBodyPath = p.inputPaths['issueBody'];
  const dispatchInputsPath = p.inputPaths['dispatchInputs'];
  if (!issueBodyPath || !dispatchInputsPath) {
    throw new Error('[start_developer_agent_async] contract.inputParams must define "issueBody" and "dispatchInputs"');
  }

  writeFileSync(issueBodyPath, JSON.stringify({ issueBody: prepared.issueBody }, null, 2) + '\n', 'utf8');
  writeFileSync(dispatchInputsPath, JSON.stringify(prepared.dispatchInputs, null, 2) + '\n', 'utf8');

  const state: StartDeveloperAgentAsyncStateFile = {
    version: START_DEVELOPER_AGENT_ASYNC_STATE_VERSION,
    runnerCtx: {
      issueKey: ctx.issueKey,
      owner: ctx.owner,
      repo: ctx.repo,
      ref: ctx.ref,
      callerConfig: ctx.callerConfig,
      configFile: ctx.configFile,
      githubIssueNumber: ctx.githubIssueNumber ?? 0,
    },
  };
  writeFileSync(pState.state, JSON.stringify(state, null, 2) + '\n', 'utf8');
  writeInvocationHandoffManifestFile(p.base, contract);
  console.log(`[start_developer_agent_async] Wrote ${issueBodyPath}, ${dispatchInputsPath}, ${pState.state}`);
}
