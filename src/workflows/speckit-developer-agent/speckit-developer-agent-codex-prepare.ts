/**
 * SpecKit Developer Agent — Codex prepare phase (speckit + fix).
 *
 * Branch on `AGENT_MODE` / Codex model (`getEffectiveModel` in speckit-developer-agent-config):
 *   speckit (default) — pipeline config + `$speckit-{step}` → input_prompt.md. Branch/PR/state normally come from
 *     CI: for **specify**, `speckit-developer-agent-github-bootstrap.ts` runs first and writes `speckit-state.json`; this script only reads state and builds the Codex prompt (no git / no PR creation here).
 *   fix — targeted fix prompt from speckit-state + INPUT_PROMPT → input_prompt.md
 *
 * Environment — common:
 *   GITHUB_TOKEN or COPILOT_PAT, GITHUB_REPOSITORY, CONFIG_FILE, DEVELOPER_MODEL (legacy: DEVELOPER_AGENT_MODEL)
 *
 * Environment — speckit:
 *   ISSUE_NUMBER, ISSUE_KEY, STEP, BRANCH_NAME — same ref the workflow checked out; optional PR_NUMBER must match state when set
 *
 * Environment — fix:
 *   ISSUE_KEY, INPUT_PROMPT — /fix text for the fix template, or a repo-relative path to a
 *     prompt file (if the path exists as a file, its contents are used as input_prompt.md as-is)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';

import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import {
  ASYNC_INVOCATION_HANDOFF_ROOT_DIR,
  writeInvocationHandoffManifestFile,
  type AgentInvocationContract,
} from '../../lib/agent-invocation-contract.js';
import { findSpeckitStateFilePath } from './speckit-state-path.js';
import { tryWriteSpecKitIssueContextFile } from './spec-kit-context/issue-context.js';
import {
  tryLoadConfig,
  getEffectiveModel,
  getEffectiveTicketContextDepth,
} from './speckit-developer-agent-config.js';
import {
  type SpeckitStep,
  type SpeckitWorkflowBaseState,
  parseSpeckitStep,
} from './speckit-step-model.js';

/** Invocation contract for fix mode: prompt in, Codex result out (no jiraContext needed). */
const FIX_INVOCATION_CONTRACT: AgentInvocationContract = {
  inputParams: {
    prompt: { kind: 'artifact', scope: 'handoff_workspace', relativePath: 'invocation-prompt.md' },
  },
  outputParams: {
    resultState: { kind: 'artifact', scope: 'handoff_workspace', relativePath: 'invocation-output.txt' },
  },
};

/* ------------------------------------------------------------------ */
/*  Mode                                                               */
/* ------------------------------------------------------------------ */

type AgentMode = 'speckit' | 'fix';

function getAgentMode(): AgentMode {
  const m = (process.env['AGENT_MODE'] ?? process.env['DEVELOPER_AGENT_MODE'] ?? 'speckit')
    .trim()
    .toLowerCase();
  return m === 'fix' ? 'fix' : 'speckit';
}

type SpeckitState = SpeckitWorkflowBaseState;

interface PipelineConfig {
  specifyInput: string;
  clarifyInput: string;
  planInput: string;
  tasksInput: string;
  implementInput: string;
  codeReviewInput?: string;
}

/* ------------------------------------------------------------------ */
/*  Types (fix)                                                        */
/* ------------------------------------------------------------------ */

interface FixSpeckitState {
  issueNumber?: number;
  issueKey: string;
  prNumber: number;
  branchName: string;
  featureDir?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
  console.log(`[codex-prepare] output: ${name}=${value}`);
}

function extractPipelineConfig(issueBody: string): PipelineConfig {
  const match = issueBody.match(/<!--sdlc-pipeline-config\s*([\s\S]*?)\s*\/sdlc-pipeline-config-->/);
  if (!match) {
    throw new Error(
      'Could not find `<!--sdlc-pipeline-config ... /sdlc-pipeline-config-->` block in issue body',
    );
  }
  return JSON.parse(match[1]) as PipelineConfig;
}

/* ------------------------------------------------------------------ */
/*  Speckit setup                                                      */
/* ------------------------------------------------------------------ */

async function runSpeckitSetup(): Promise<void> {
  // Load config if available
  const config = tryLoadConfig();

  const token = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey = requireEnv('ISSUE_KEY');
  const step = parseSpeckitStep(requireEnv('STEP'));

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit = new Octokit({ auth: token });

  let branchName: string;
  let prNumber: number;
  let featureDir = '';

  if (step === 'specify') {
    const bn = requireEnv('BRANCH_NAME').trim();
    if (!bn) throw new Error('BRANCH_NAME is required and must be non-empty for specify');
    branchName = bn;
    const explicitPr = process.env['PR_NUMBER']?.trim();
    const statePathEarly = findSpeckitStateFilePath(issueKey);

    if (existsSync(statePathEarly)) {
      const saved = JSON.parse(readFileSync(statePathEarly, 'utf8')) as SpeckitState;
      if (saved.branchName && saved.branchName !== branchName) {
        throw new Error(
          `speckit-state.json branchName "${saved.branchName}" does not match BRANCH_NAME "${branchName}"`,
        );
      }
      prNumber = saved.prNumber;
      if (explicitPr && String(prNumber) !== explicitPr) {
        throw new Error(
          `PR_NUMBER env (${explicitPr}) does not match speckit-state prNumber (${prNumber})`,
        );
      }
      featureDir = saved.featureDir ?? dirname(statePathEarly);
      console.log(
        `[codex-prepare] specify: using speckit-state at ${statePathEarly} — PR #${prNumber}`,
      );
    } else {
      throw new Error(
        `speckit-state.json not found for specify (expected at ${statePathEarly}). ` +
          'GitHub bootstrap must run before codex-prepare for specify, or the checked-out ref must already contain state from a prior bootstrap.',
      );
    }
  } else {
    const statePath = findSpeckitStateFilePath(issueKey);
    if (!existsSync(statePath)) throw new Error(`speckit-state.json not found (searched legacy path + find)`);
    const saved = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
    branchName = saved.branchName;
    prNumber = saved.prNumber;
    featureDir = saved.featureDir ?? dirname(statePath);
    console.log(`[codex-prepare] Continuing on PR #${prNumber} (branch: ${branchName})`);
  }

  const ticketContextDepth = getEffectiveTicketContextDepth(config);
  await tryWriteSpecKitIssueContextFile({
    issueKey,
    cwd: process.cwd(),
    ticketContextDepth,
  });

  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
  const pipelineConfig = extractPipelineConfig(issue.body ?? '');
  const defaultCodeReviewPrompt = loadTemplate(
    import.meta.url,
    'prompts',
    'code-review-default-input.md',
  );

  const stepInputMap: Record<SpeckitStep, string> = {
    specify: pipelineConfig.specifyInput,
    clarify: pipelineConfig.clarifyInput,
    plan: pipelineConfig.planInput,
    tasks: pipelineConfig.tasksInput,
    implement: pipelineConfig.implementInput,
    code_review: pipelineConfig.codeReviewInput?.trim() || defaultCodeReviewPrompt,
  };
  const input = stepInputMap[step];

  const skillFilePath = `.agents/skills/speckit-${step}/SKILL.md`;
  if (!existsSync(skillFilePath)) {
    throw new Error(
      `Native Codex skill not found: ${skillFilePath}\n` +
        `Run the onboarding workflow to install spec-kit skills into .agents/skills/.`,
    );
  }

  const codexModel = getEffectiveModel(config);
  const promptContent = `$speckit-${step} ${input}`;

  mkdirSync('.sdlc-agents', { recursive: true });
  writeFileSync('.sdlc-agents/input_prompt.md', promptContent + '\n');
  console.log(`[codex-prepare] Wrote prompt to .sdlc-agents/input_prompt.md`);

  setOutput('branch_name', branchName);
  setOutput('pr_number', String(prNumber));
  setOutput('feature_dir', featureDir);
  setOutput('model', codexModel);

  console.log(`[codex-prepare] Codex prepare complete — step=${step} branch=${branchName} pr=#${prNumber}`);
}

/* ------------------------------------------------------------------ */
/*  Fix setup                                                          */
/* ------------------------------------------------------------------ */

/**
 * Write the fix prompt to the invocation-handoff workspace and set Codex artifact path outputs.
 * Mirrors how AI Teammate BA prepare writes artifacts; keeps both modes consistent.
 */
function writeFixHandoffArtifact(issueKey: string, promptContent: string, featureDir: string, codexModel: string): void {
  const handoffBase = join(process.cwd(), ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey);
  mkdirSync(handoffBase, { recursive: true });
  writeFileSync(join(handoffBase, 'invocation-prompt.md'), promptContent.endsWith('\n') ? promptContent : `${promptContent}\n`, 'utf8');
  writeInvocationHandoffManifestFile(handoffBase, FIX_INVOCATION_CONTRACT);
  const handoffDir = join(ASYNC_INVOCATION_HANDOFF_ROOT_DIR, issueKey).replace(/\\/g, '/');
  setOutput('prompt_file', `${handoffDir}/invocation-prompt.md`);
  setOutput('output_file', `${handoffDir}/invocation-output.txt`);
  setOutput('handoff_dir', handoffDir);
  setOutput('feature_dir', featureDir);
  setOutput('model', codexModel);
  console.log(`[codex-prepare] fix: handoff workspace → ${handoffBase}`);
}

async function runFixSetup(): Promise<void> {
  // Load config if available
  const config = tryLoadConfig();

  const token = process.env['COPILOT_PAT'] ?? process.env['GITHUB_TOKEN'] ?? '';
  const repository = process.env['GITHUB_REPOSITORY'] ?? '';
  const issueKey = requireEnv('ISSUE_KEY');
  let fixInstructions = requireEnv('INPUT_PROMPT').replace(/^\s*\/fix\s*/, '');
  const codexModel = getEffectiveModel(config);

  const statePath = findSpeckitStateFilePath(issueKey);
  if (!existsSync(statePath)) {
    throw new Error(`speckit-state.json not found for ${issueKey} (searched legacy path + find)`);
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as FixSpeckitState;
  const featureDir = state.featureDir ?? dirname(statePath);

  // Same PR branch / PR # as spec-kit recorded — job outputs match speckit (Codex always checks out this branch).
  setOutput('branch_name', state.branchName);
  setOutput('pr_number', String(state.prNumber));

  console.log(`[codex-prepare] fix: featureDir=${featureDir} model=${codexModel}`);

  const pathCandidate = fixInstructions.trim();
  if (pathCandidate && existsSync(pathCandidate) && statSync(pathCandidate).isFile()) {
    const body = readFileSync(pathCandidate, 'utf8');
    writeFixHandoffArtifact(issueKey, body, featureDir, codexModel);
    console.log(`[codex-prepare] fix: copied prompt from file ${pathCandidate} → handoff workspace`);
    console.log('[codex-prepare] fix: setup complete (raw prompt file)');
    return;
  }

  let issueContext = '';
  const issueNumber = state.issueNumber;
  if (issueNumber && token && repository) {
    try {
      const [owner, repo] = repository.split('/');
      const octokit = new Octokit({ auth: token });
      const { data: issue } = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });
      const cleanBody = (issue.body ?? '')
        .replace(/<!--sdlc-pipeline-config[\s\S]*?\/sdlc-pipeline-config-->/g, '')
        .trim();
      issueContext = [
        `## Feature Context`,
        ``,
        `**Issue #${issueNumber}**: ${issue.title}`,
        ...(cleanBody ? [``, cleanBody] : []),
      ].join('\n');
      console.log(`[codex-prepare] fix: fetched issue #${issueNumber}: "${issue.title}"`);
    } catch (err) {
      console.warn('[codex-prepare] fix: could not fetch issue (non-fatal):', err);
    }
  }

  const separatorIdx = fixInstructions.indexOf('\n\n---\n\n## Spec Gate Issues to Address');
  const userInstruction =
    separatorIdx >= 0 ? fixInstructions.slice(0, separatorIdx).trim() : fixInstructions.trim();
  const specGateContext =
    separatorIdx >= 0 ? fixInstructions.slice(separatorIdx + '\n\n---\n\n'.length).trim() : '';

  const issueSection = issueContext ? `${issueContext}\n\n` : '';
  const specGateSection = specGateContext ? `${specGateContext}\n\n` : '';
  const reviewerSection = userInstruction ? `## Reviewer Instructions\n\n${userInstruction}\n\n` : '';

  const tmpl = loadTemplate(import.meta.url, 'prompts', 'codex-fix-user-prompt.md');
  const prompt = fillTemplate(tmpl, {
    FEATURE_DIR: featureDir,
    ISSUE_CONTEXT: issueSection,
    SPEC_GATE_SECTION: specGateSection,
    REVIEWER_SECTION: reviewerSection,
  });

  writeFixHandoffArtifact(issueKey, prompt, featureDir, codexModel);
  console.log(`[codex-prepare] fix: wrote prompt to handoff workspace (${prompt.length} chars)`);
  console.log('[codex-prepare] fix: setup complete');
}

/* ------------------------------------------------------------------ */
/*  Entry                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const mode = getAgentMode();
  if (mode === 'fix') await runFixSetup();
  else await runSpeckitSetup();
}

main().catch(err => {
  console.error('[codex-prepare] Fatal error:', err);
  process.exit(1);
});
