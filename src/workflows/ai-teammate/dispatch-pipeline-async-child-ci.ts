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
import { parseAgentPipelineSteps } from '../../lib/pipeline-config.js';
import { buildParentRunFields, mergeCallerConfigForAsyncChildDispatch } from '../../lib/pipeline-callback-config.js';
import { decodeCallerConfig, isParentAsyncChildResumeCallerConfig } from '../../lib/caller-config.js';
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

function maybeParseAsyncHandoffFromOutput(): {
  triggerStep?: string;
  workflowFile?: string;
  issueKey?: string;
  githubIssueNumber?: number;
} {
  const raw = process.env.ASYNC_HANDOFF?.trim() ?? '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as {
      triggerStep?: string;
      workflowFile?: string;
      issueKey?: string;
      githubIssueNumber?: number;
    };
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    console.warn('[dispatch-pipeline-async-child] ASYNC_HANDOFF is not valid JSON; ignoring.');
    return {};
  }
}

async function main(): Promise<void> {
  console.log('[dispatch-pipeline-async-child] ======== START DISPATCH PROCESS ========');
  const configFile = requireEnv('CONFIG_FILE');
  const callerConfigEncoded = requireEnv('CALLER_CONFIG');
  const runCodex = requireEnv('AI_TEAMMATE_RUN_CODEX') === 'true';
  const concurrencyKey = requireEnv('AI_TEAMMATE_CONCURRENCY_KEY');
  const entryWorkflow = process.env.AI_TEAMMATE_ENTRY_WORKFLOW_FILE?.trim() || 'ai-teammate.yml';

  console.log(`[dispatch-pipeline-async-child] configFile: ${configFile}`);
  console.log(`[dispatch-pipeline-async-child] runCodex: ${runCodex}`);
  console.log(`[dispatch-pipeline-async-child] concurrencyKey: ${concurrencyKey}`);
  console.log(`[dispatch-pipeline-async-child] entryWorkflow: ${entryWorkflow}`);

  const handoff = maybeParseAsyncHandoffFromOutput();
  console.log(`[dispatch-pipeline-async-child] ASYNC_HANDOFF raw env: ${process.env.ASYNC_HANDOFF?.trim() ?? '(empty)'}`);
  console.log(`[dispatch-pipeline-async-child] handoff parsed:`, JSON.stringify(handoff, null, 2));

  // Check if we're in a resume context — if so, only skip if trying to dispatch the SAME step
  // (prevents cycle). If it's a NEW async step, we should dispatch it.
  const callerRoot = decodeCallerConfig(callerConfigEncoded);
  console.log(`[dispatch-pipeline-async-child] callerRoot has async_child_run_id: ${!!callerRoot.params?.async_child_run_id}, async_trigger_step: ${callerRoot.params?.async_trigger_step ?? '(none)'}`);
  const isResume = isParentAsyncChildResumeCallerConfig(callerRoot);
  console.log(`[dispatch-pipeline-async-child] isParentAsyncChildResumeCallerConfig result: ${isResume}`);

  // If we're resuming, check if the current triggerStep matches the previous async_trigger_step
  // If they match, we're trying to re-dispatch the same step (cycle prevention)
  // If they differ, we're at a NEW async boundary and should dispatch
  if (isResume) {
    const previousTriggerStep = callerRoot.params?.async_trigger_step?.trim() ?? '';
    const currentTriggerStep = handoff.triggerStep?.trim() ?? '';
    console.log(`[dispatch-pipeline-async-child] Comparing steps: previous="${previousTriggerStep}", current="${currentTriggerStep}"`);

    if (currentTriggerStep && previousTriggerStep === currentTriggerStep) {
      setOutput('dispatched', 'false');
      console.log('[dispatch-pipeline-async-child] Skipping dispatch — parent is resuming at the SAME async step (prevents cycle).');
      appendJobSummary(
        [
          '### AI Teammate — async handoff',
          '',
          'The pipeline set **async handoff**, but the child workflow was **not** dispatched.',
          '',
          `- **Concurrency key:** \`${concurrencyKey}\``,
          '- **Reason:** Parent is resuming after async child completion at the same step (prevents infinite cycle).',
          `- **Step:** \`${currentTriggerStep}\``,
          '',
          `_Config file:_ \`${configFile}\``,
        ].join('\n'),
      );
      return;
    } else {
      console.log('[dispatch-pipeline-async-child] Parent is resuming but this is a NEW async step — continuing with dispatch.');
    }
  }

  // The pipeline already identified the specific async step and passed it via ASYNC_HANDOFF output.
  // Use the workflowFile from handoff instead of searching for the first async step.
  console.log(`[dispatch-pipeline-async-child] Checking workflowFile from handoff: "${handoff.workflowFile?.trim() ?? '(empty)'}"`);
  if (!handoff.workflowFile?.trim()) {
    setOutput('dispatched', 'false');
    console.log('[dispatch-pipeline-async-child] No workflowFile in ASYNC_HANDOFF — not dispatching async child.');
    appendJobSummary(
      [
        '### AI Teammate — async handoff',
        '',
        'The pipeline set **async handoff**, but the child workflow was **not** dispatched.',
        '',
        `- **Concurrency key:** \`${concurrencyKey}\``,
        '- **Reason:** No workflowFile in ASYNC_HANDOFF output (pipeline should set this).',
        '',
        `_Config file:_ \`${configFile}\``,
      ].join('\n'),
    );
    return;
  }

  const workflowFile = handoff.workflowFile.trim();
  console.log(`[dispatch-pipeline-async-child] workflowFile set to: "${workflowFile}"`);

  // Need to load the config to get the async_call details (workflowRef, terminal, inputs, etc.)
  const abs = resolve(process.cwd(), configFile);
  console.log(`[dispatch-pipeline-async-child] Loading config from absolute path: ${abs}`);
  const raw = readFileSync(abs, 'utf8');
  const steps = parseAgentPipelineSteps(raw, configFile);
  console.log(`[dispatch-pipeline-async-child] Parsed ${steps.length} steps from config`);

  // Find the step by triggerStep id first (stable, avoids ambiguity when multiple steps share the
  // same workflowFile), then fall back to matching by workflowFile for older pipeline outputs.
  const triggerStep = handoff.triggerStep?.trim();
  console.log(`[dispatch-pipeline-async-child] Searching for step with triggerStep id: "${triggerStep ?? '(none)'}"`);
  console.log(`[dispatch-pipeline-async-child] Step ids in config: ${steps.map(s => `"${s.id}"`).join(', ')}`);
  const step = triggerStep
    ? steps.find(s => s.id === triggerStep)
    : steps.find(s => s.async_call?.workflowFile?.trim() === workflowFile);
  console.log(`[dispatch-pipeline-async-child] Found step: ${step ? `runner="${step.runner}", id="${step.id}", has async_call=${!!step.async_call}` : '(not found)'}`);
  if (!step || !step.async_call) {
    const reason = triggerStep
      ? `No step with id="${triggerStep}" found in config.`
      : `No step with async_call.workflowFile="${workflowFile}" found in config.`;
    setOutput('dispatched', 'false');
    console.log(`[dispatch-pipeline-async-child] ${reason} — not dispatching.`);
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

  const ac = step.async_call;
  const ref = (ac.workflowRef?.trim() || requireEnv('GITHUB_REF_NAME')).trim();
  console.log(`[dispatch-pipeline-async-child] async_call: workflowFile="${ac.workflowFile}", workflowRef="${ac.workflowRef ?? ''}", terminal=${ac.terminal ?? false}, inputs keys=[${Object.keys(ac.inputs ?? {}).join(', ')}]`);
  console.log(`[dispatch-pipeline-async-child] Using ref: "${ref}"`);

  const repoFull = requireEnv('GITHUB_REPOSITORY');
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: ${repoFull}`);
  console.log(`[dispatch-pipeline-async-child] Repository: ${owner}/${repo}`);

  const parentFields = buildParentRunFields({
    githubServerUrl: requireEnv('GITHUB_SERVER_URL'),
    githubRepository: repoFull,
    githubRunId: requireEnv('GITHUB_RUN_ID'),
  });
  console.log(`[dispatch-pipeline-async-child] Parent run fields: parent_run_id=${parentFields.parent_run_id}, has parent_run_url=${!!parentFields.parent_run_url}`);

  const stepId = handoff.triggerStep?.trim() || step.id;
  console.log(`[dispatch-pipeline-async-child] Using stepId: "${stepId}"`);

  const terminal = ac.terminal === true;
  console.log(`[dispatch-pipeline-async-child] Is terminal operation: ${terminal}`);
  const mergedCaller = terminal
    ? callerConfigEncoded
    : mergeCallerConfigForAsyncChildDispatch(callerConfigEncoded, {
        callback: entryWorkflow,
        async_trigger_step: stepId,
        ...parentFields,
      });

  // Build inputs based on the target workflow
  let inputs: Record<string, string> = {};

  // For developer-agent.yml (terminal operation), build developer agent inputs
  console.log(`[dispatch-pipeline-async-child] Checking if terminal && workflowFile === 'developer-agent.yml': terminal=${terminal}, workflowFile="${workflowFile}"`);
  if (terminal && workflowFile === 'developer-agent.yml') {
    const issueKey = handoff.issueKey || concurrencyKey;
    const githubIssueNumber = handoff.githubIssueNumber?.toString() || '';

    console.log(`[dispatch-pipeline-async-child] Building developer agent inputs...`);
    console.log(`[dispatch-pipeline-async-child]   - issueKey: "${issueKey}"`);
    console.log(`[dispatch-pipeline-async-child]   - githubIssueNumber: "${githubIssueNumber}"`);

    inputs = {
      mode: 'speckit',
      issue_number: githubIssueNumber,
      issue_key: issueKey,
      step: 'specify',
      branch_name: '',  // Empty means bootstrap will create the branch
      pr_number: '',
      prompt: '',
    };

    console.log(`[dispatch-pipeline-async-child] Developer agent inputs built: mode=${inputs.mode}, issue_key=${inputs.issue_key}, issue_number=${inputs.issue_number}, step=${inputs.step}`);
  } else {
    // For other workflows (like business-analyst.yml), use AI Teammate inputs
    console.log(`[dispatch-pipeline-async-child] Building AI Teammate inputs (not developer-agent.yml)...`);
    inputs = {
      ...buildAiTeammateWorkflowDispatchInputsWithCaller({
        concurrencyKey,
        configFile,
        callerConfigEncoded: mergedCaller,
      }),
    };
    console.log(`[dispatch-pipeline-async-child] AI Teammate inputs built with ${Object.keys(inputs).length} keys: ${Object.keys(inputs).join(', ')}`);
  }

  // Merge any additional inputs from config
  if (ac.inputs) {
    console.log(`[dispatch-pipeline-async-child] Merging additional inputs from async_call.inputs (${Object.keys(ac.inputs).length} keys)`);
    for (const [k, v] of Object.entries(ac.inputs)) {
      if (v !== undefined && v !== null) inputs[k] = String(v);
    }
  }

  console.log(`[dispatch-pipeline-async-child] Final inputs: ${Object.keys(inputs).length} total keys`);

  const payload = buildGithubWorkflowDispatchPayload({
    owner,
    repo,
    workflowId: workflowFile,
    ref,
    inputs,
  });

  console.log(`[dispatch-pipeline-async-child] Workflow dispatch: owner=${owner}, repo=${repo}, workflowId=${workflowFile}, ref=${ref}, inputs count=${Object.keys(inputs).length}`);
  console.log(`[dispatch-pipeline-async-child] Dispatching workflow...`);

  const octokit = new Octokit({ auth: requireEnv('COPILOT_PAT') });
  await dispatchGithubWorkflow(octokit, payload);

  console.log(`[dispatch-pipeline-async-child] Dispatched ${workflowFile}@${ref} for ${concurrencyKey}.`);
  console.log('[dispatch-pipeline-async-child] ======== DISPATCH SUCCESSFUL ========');
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
