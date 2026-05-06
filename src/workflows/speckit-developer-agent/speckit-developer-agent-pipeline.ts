/**
 * SpecKit Developer Agent Pipeline Runner.
 *
 * Executes spec-kit steps (specify, clarify, plan, tasks, implement, code_review) as a pipeline.
 * Similar to AI-Teammate pipeline but adapted for spec-kit workflow.
 *
 * Key features:
 * - Automatic progression through spec-kit steps
 * - Async boundaries for each Codex execution
 * - Resume capability after async operations
 * - State persistence via speckit-state.json
 * - Backward compatible with legacy step-by-step mode
 *
 * Supported step runners:
 *   validate_spec_kit_prerequisites — ensures spec-kit skills are installed
 *   spec_kit_step                   — executes a spec-kit step (specify, clarify, etc.) via Codex
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  decodeCallerConfig,
  isParentAsyncChildResumeCallerConfig,
  requireAsyncResumeTriggerStepId,
} from '../../lib/caller-config.js';
import { normalizePipelineStepIds, type PipelineStepConfig } from '../../lib/pipeline-config.js';
import {
  findPipelineStepIndexById,
  isStepEnabled,
} from '../../lib/pipeline-expected-step-helper.js';
import { loadSpeckitDeveloperAgentConfig } from './speckit-developer-agent-config.js';
import { findSpeckitStateFilePath } from './speckit-state-path.js';
import type {
  RunnerContext,
  PipelineStep,
  StepOutcome,
  StepRecord,
  SpeckitState,
  SpeckitDeveloperAgentDeps,
} from './speckit-runner-types.js';

const SPECKIT_STATE_VERSION = 2;

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${name}=${value}\n`, 'utf8');
  console.log(`[speckit-pipeline] output: ${name}=${value}`);
}

/** Truncate a commit SHA to a short display form */
function shortSha(sha: string): string {
  return sha.substring(0, 8);
}

/** Run a single pipeline step */
export async function runPipelineStep(
  ctx: RunnerContext,
  step: PipelineStep,
  deps: SpeckitDeveloperAgentDeps,
): Promise<StepOutcome> {
  switch (step.runner) {
    case 'validate_spec_kit_prerequisites': {
      return runValidatePrerequisites(ctx);
    }

    case 'spec_kit_step': {
      return runSpecKitStep(ctx, step, deps);
    }

    case 'validate_spec_kit_output': {
      return runValidateSpecKitOutput(ctx, step);
    }

    default:
      throw new Error(
        `Unknown pipeline step runner: "${step.runner}". ` +
          `Supported: validate_spec_kit_prerequisites, spec_kit_step, validate_spec_kit_output.`,
      );
  }
}

/** Validate that spec-kit skills are installed */
async function runValidatePrerequisites(ctx: RunnerContext): Promise<StepOutcome> {
  const skillsDir = '.agents/skills';
  const requiredSkills = ['speckit-specify', 'speckit-clarify', 'speckit-plan', 'speckit-tasks', 'speckit-implement', 'speckit-code_review'];

  console.log('[validate_prerequisites] Checking spec-kit skills...');

  const missing: string[] = [];
  for (const skill of requiredSkills) {
    const skillPath = join(skillsDir, skill, 'SKILL.md');
    if (!existsSync(skillPath)) {
      missing.push(skill);
    }
  }

  if (missing.length > 0) {
    const reason = `Missing spec-kit skills: ${missing.join(', ')}. Run the onboarding workflow to install them.`;
    console.error(`[validate_prerequisites] ❌ ${reason}`);
    return { status: 'stop', reason };
  }

  console.log('[validate_prerequisites] ✅ All spec-kit skills found');
  return { status: 'continue' };
}

/** Execute a spec-kit step (specify, clarify, plan, tasks, implement, code_review) */
async function runSpecKitStep(
  ctx: RunnerContext,
  step: PipelineStep,
  deps: SpeckitDeveloperAgentDeps,
): Promise<StepOutcome> {
  const stepName = step.stepName as string;
  if (!stepName) {
    throw new Error('spec_kit_step requires stepName parameter');
  }

  console.log(`[spec_kit_step] Preparing ${stepName} step...`);

  // For now, this runner just prepares the context for async Codex execution
  // The actual Codex run happens via async_call to _reusable-codex-run.yml
  // After Codex completes and workflow resumes, we update the state

  // On first run (not resume): prepare prompt and write input_prompt.md
  // On resume: verify outputs exist and update state

  const isResume = isParentAsyncChildResumeCallerConfig(decodeCallerConfig(ctx.callerConfig));

  if (isResume) {
    console.log(`[spec_kit_step] Resume after ${stepName} Codex execution`);
    // Verify outputs exist (artifacts should be committed by teardown)
    // Update speckit-state.json to mark step as complete
    await updateSpeckitStateAfterStep(ctx, stepName);
  } else {
    console.log(`[spec_kit_step] First run: preparing ${stepName} prompt`);
    // Prepare prompt for Codex (done by setup script, not here)
    // Pipeline will pause here for async_call dispatch
  }

  return { status: 'continue' };
}

/** Validate spec-kit step output artifacts */
async function runValidateSpecKitOutput(ctx: RunnerContext, step: PipelineStep): Promise<StepOutcome> {
  const stepName = step.stepName as string;
  if (!stepName) {
    throw new Error('validate_spec_kit_output requires stepName parameter');
  }

  console.log(`[validate_spec_kit_output] Validating ${stepName} outputs...`);

  const featureDir = ctx.featureDir;
  if (!featureDir) {
    const reason = `Feature directory not set in context`;
    console.error(`[validate_spec_kit_output] ❌ ${reason}`);
    return { status: 'stop', reason };
  }

  // Get expected artifacts from step config
  const expectedArtifacts = (step.expectedArtifacts as string[]) ?? [];
  const minFileSize = (step.minFileSize as number) ?? 0;
  const validateCodeChanges = (step.validateCodeChanges as boolean) ?? false;

  // Check each expected artifact
  const missing: string[] = [];
  const tooSmall: string[] = [];

  for (const artifact of expectedArtifacts) {
    const artifactPath = join(featureDir, artifact);

    if (!existsSync(artifactPath)) {
      missing.push(artifact);
      continue;
    }

    // Check file size
    const stats = statSync(artifactPath);
    if (stats.size < minFileSize) {
      tooSmall.push(`${artifact} (${stats.size} bytes < ${minFileSize} bytes)`);
    }
  }

  // For implement step, validate that code changes were made
  if (validateCodeChanges) {
    console.log(`[validate_spec_kit_output] Checking for code changes...`);

    // Load the base commit SHA that was recorded just before the async Codex dispatch.
    // In an async pipeline the Codex job commits & pushes on a remote runner, so the
    // local working tree is clean on resume — we must compare commit SHAs instead.
    const statePath = findSpeckitStateFilePath(ctx.issueKey);
    let baseCommitSha: string | undefined;
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
      baseCommitSha = state.baseCommitSha;
    }

    try {
      const { execSync } = await import('node:child_process');
      const currentSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

      if (baseCommitSha) {
        // Compare persisted base SHA to current HEAD
        if (currentSha === baseCommitSha) {
          const reason = `No code changes detected after implement step (HEAD is still ${shortSha(currentSha)})`;
          console.error(`[validate_spec_kit_output] ❌ ${reason}`);
          return { status: 'stop', reason };
        }
        console.log(
          `[validate_spec_kit_output] ✓ New commits detected: ${shortSha(baseCommitSha)} → ${shortSha(currentSha)}`,
        );
      } else {
        // No base SHA recorded (non-pipeline or old state): fall back to working-tree check
        const gitDiff = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).trim();
        const gitStatus = execSync('git status --short', { encoding: 'utf8' }).trim();

        if (!gitDiff && !gitStatus) {
          const reason = `No code changes detected after implement step`;
          console.error(`[validate_spec_kit_output] ❌ ${reason}`);
          return { status: 'stop', reason };
        }

        console.log(`[validate_spec_kit_output] ✓ Code changes detected`);
      }
    } catch (err) {
      console.warn(`[validate_spec_kit_output] Could not check code changes: ${err}`);
      // Don't fail validation on git errors
    }
  }

  // Report validation results
  if (missing.length > 0) {
    const reason = `Missing expected artifacts for ${stepName}: ${missing.join(', ')}`;
    console.error(`[validate_spec_kit_output] ❌ ${reason}`);
    return { status: 'stop', reason };
  }

  if (tooSmall.length > 0) {
    const reason = `Artifacts below minimum size for ${stepName}: ${tooSmall.join(', ')}`;
    console.error(`[validate_spec_kit_output] ❌ ${reason}`);
    return { status: 'stop', reason };
  }

  console.log(`[validate_spec_kit_output] ✅ All validations passed for ${stepName}`);
  return { status: 'continue' };
}

/** Update speckit-state.json after completing a step */
async function updateSpeckitStateAfterStep(ctx: RunnerContext, stepName: string): Promise<void> {
  const issueKey = ctx.issueKey;
  const statePath = findSpeckitStateFilePath(issueKey);

  let state: SpeckitState;
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
  } else {
    // Initialize state if it doesn't exist
    state = {
      completedSteps: [],
      nextStep: null,
      lastUpdated: new Date().toISOString(),
      issueNumber: ctx.issueNumber ?? 0,
      issueKey,
      prNumber: ctx.prNumber ?? 0,
      branchName: ctx.branchName ?? '',
      featureDir: ctx.featureDir,
      version: SPECKIT_STATE_VERSION,
    };
  }

  // Add step to completed steps if not already there
  if (!state.completedSteps.includes(stepName)) {
    state.completedSteps.push(stepName);
  }

  // Determine next step
  const stepOrder = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'code_review'];
  const currentIndex = stepOrder.indexOf(stepName);
  state.nextStep = currentIndex >= 0 && currentIndex < stepOrder.length - 1
    ? stepOrder[currentIndex + 1]
    : null;

  state.lastUpdated = new Date().toISOString();

  // Ensure directory exists
  mkdirSync(dirname(statePath), { recursive: true });

  // Write updated state
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(`[spec_kit_step] Updated speckit-state.json: completed=${state.completedSteps.join(',')}, next=${state.nextStep ?? 'none'}`);
}

/** Write pipeline summary to GitHub Actions job summary */
export async function writeSpeckitPipelineSummary(
  issueKey: string,
  records: StepRecord[],
  ctx: RunnerContext,
): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const icon = (s: StepRecord) => (s.status === 'continue' ? '✅' : '🛑');
  const ms = (n: number) => (n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`);

  const rows = records
    .map(r => {
      const stepLabel = r.stepName ? `${r.runner} (${r.stepName})` : r.runner;
      const outcome = `${icon(r)} ${r.status}${r.reason ? ` — ${r.reason}` : ''}`;
      return `| \`${stepLabel}\` | ${outcome} | ${ms(r.durationMs)} |`;
    })
    .join('\n');

  const finalStep = records.at(-1);
  const pipelineStatus = finalStep?.status === 'stop' ? '🛑 Halted' : '✅ Completed';

  const summary = `
## SpecKit Developer Agent Pipeline — ${issueKey}

**Status:** ${pipelineStatus}
**PR:** ${ctx.prNumber ? `[#${ctx.prNumber}](https://github.com/${ctx.owner}/${ctx.repo}/pull/${ctx.prNumber})` : '—'}
**Branch:** \`${ctx.branchName ?? '—'}\`

### Pipeline Steps

| Step | Outcome | Duration |
|------|---------|----------|
${rows}
`;

  appendFileSync(summaryPath, summary + '\n');
}

/**
 * Run the full pipeline from start to finish.
 * Handles resume after async operations.
 */
export async function runPipeline(
  issueKey: string,
  steps: PipelineStep[],
  deps: SpeckitDeveloperAgentDeps,
  ctxInit: Omit<RunnerContext, 'issueKey'>,
): Promise<{ ctx: RunnerContext; records: StepRecord[] }> {
  const ctx: RunnerContext = { issueKey, ...ctxInit };
  const records: StepRecord[] = [];

  // Determine starting point (resume logic)
  const callerRoot = decodeCallerConfig(ctx.callerConfig);
  const isResume = isParentAsyncChildResumeCallerConfig(callerRoot);

  let startIndex = 0;
  let resumeTriggerStepId: string | undefined;

  if (isResume) {
    resumeTriggerStepId = requireAsyncResumeTriggerStepId(callerRoot);
    console.log(`[speckit-pipeline] Resume mode: async_trigger_step="${resumeTriggerStepId}"`);

    // Load checkpoint records from prior run
    const statePath = findSpeckitStateFilePath(issueKey);
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
      if (state.pipelineRecords) {
        records.push(...state.pipelineRecords.map(r => ({ ...r, source: 'prepare_checkpoint' as const })));
      }
    }

    // Find the index of the async trigger step
    const triggerIndex = findPipelineStepIndexById(steps, resumeTriggerStepId);
    if (triggerIndex === -1) {
      throw new Error(`Resume: async_trigger_step "${resumeTriggerStepId}" not found in pipeline steps`);
    }

    // Start at the trigger step (we'll complete it from checkpoint, then continue)
    startIndex = triggerIndex;
    console.log(`[speckit-pipeline] Resume: starting at step ${startIndex} (${steps[startIndex].runner})`);
  }

  // Execute pipeline steps
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];
    // On resume this is the step that originally triggered the async dispatch.
    // We run it so that its resume-mode logic (e.g. updateSpeckitStateAfterStep) fires,
    // but we must NOT re-dispatch its async_call.
    const isResumeTriggerStep = isResume && step.id === resumeTriggerStepId;

    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} ${step.stepName ? `(${step.stepName})` : ''} ──`);

    const stepEnabled = isStepEnabled(step);
    const t0 = Date.now();
    let outcome: StepOutcome;

    if (!stepEnabled) {
      console.log(`   ⏭ Skipped — step.enabled is false in config`);
      outcome = { status: 'continue' };
    } else {
      outcome = await runPipelineStep(ctx, step, deps);
    }

    const durationMs = Date.now() - t0;

    records.push({
      runner: step.runner,
      status: outcome.status,
      reason: outcome.status === 'stop' ? outcome.reason : !stepEnabled ? 'skipped (enabled: false)' : undefined,
      durationMs,
      source: 'this_invocation',
      stepName: step.stepName,
    });

    if (outcome.status === 'stop') {
      console.log(`\n🛑 Pipeline halted at ${step.runner}: ${outcome.reason}`);
      await writeSpeckitPipelineSummary(issueKey, records, ctx);
      throw new Error(`Pipeline stopped at ${step.runner}: ${outcome.reason}`);
    }

    // If this step has an async_call, the pipeline will pause here
    // The workflow will dispatch the async operation and wait for callback
    // On resume we skip re-dispatch for the trigger step (already dispatched)
    if (step.async_call && !isResumeTriggerStep) {
      console.log(`[speckit-pipeline] Step has async_call: pausing for dispatch to ${step.async_call.workflowFile}`);
      // Set outputs for workflow to use
      setOutput('async_step_id', step.id ?? `${step.runner}#${i}`);
      setOutput('async_workflow_file', step.async_call.workflowFile);

      // Save checkpoint before async call
      await saveCheckpoint(ctx, records);
      break; // Pipeline will resume after async operation completes
    }
  }

  await writeSpeckitPipelineSummary(issueKey, records, ctx);

  console.log(`\n✅ Pipeline completed for ${issueKey}`);
  return { ctx, records };
}

/** Save checkpoint to speckit-state.json before async operation */
async function saveCheckpoint(ctx: RunnerContext, records: StepRecord[]): Promise<void> {
  const statePath = findSpeckitStateFilePath(ctx.issueKey);

  let state: SpeckitState;
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
  } else {
    state = {
      completedSteps: [],
      nextStep: null,
      lastUpdated: new Date().toISOString(),
      issueNumber: ctx.issueNumber ?? 0,
      issueKey: ctx.issueKey,
      prNumber: ctx.prNumber ?? 0,
      branchName: ctx.branchName ?? '',
      featureDir: ctx.featureDir,
      version: SPECKIT_STATE_VERSION,
    };
  }

  // Save pipeline records for resume
  state.pipelineRecords = records;
  state.lastUpdated = new Date().toISOString();

  // Record current commit SHA so the post-async validate step can detect new commits
  try {
    const { execSync } = await import('node:child_process');
    state.baseCommitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    console.log(`[speckit-pipeline] Checkpoint base SHA: ${shortSha(state.baseCommitSha)}`);
  } catch {
    // Non-fatal: SHA recording is best-effort
  }

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(`[speckit-pipeline] Checkpoint saved to ${statePath}`);
}

/** Load pipeline configuration from environment */
export function loadSpeckitPipelineFromEnv(): {
  issueKey: string;
  steps: PipelineStep[];
  configFile: string;
  callerConfig: string;
} {
  const configFile = process.env.CONFIG_FILE?.trim();
  if (!configFile) {
    throw new Error('CONFIG_FILE environment variable is required for pipeline mode');
  }

  const callerConfig = process.env.CALLER_CONFIG?.trim();
  if (!callerConfig) {
    throw new Error('CALLER_CONFIG environment variable is required for pipeline mode');
  }

  const callerRoot = decodeCallerConfig(callerConfig);
  const issueKey = callerRoot.params?.customParams?.issue_key?.trim();
  if (!issueKey) {
    throw new Error('issue_key is required in CALLER_CONFIG.params.customParams');
  }

  // Load config and parse steps
  const config = loadSpeckitDeveloperAgentConfig(configFile);
  if (!config.params?.steps || !Array.isArray(config.params.steps)) {
    throw new Error(`${configFile}: params.steps must be a non-empty array for pipeline mode`);
  }

  const steps = normalizePipelineStepIds(config.params.steps as PipelineStepConfig[]) as PipelineStep[];

  console.log(`[speckit-pipeline] Loaded config from ${configFile}: ${steps.length} steps`);

  return { issueKey, steps, configFile, callerConfig };
}
