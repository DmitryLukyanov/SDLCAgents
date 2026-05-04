/**
 * Developer Agent — Setup phase (speckit + fix).
 *
 * Branch on `AGENT_MODE` / `DEVELOPER_AGENT_MODE`:
 *   speckit (default) — pipeline config + `$speckit-{step}` → input_prompt.md. Branch/PR/bootstrap state normally come from
 *     `developer-agent-bootstrap.ts` + checkout; specify reads `speckit-state.json` when present (else legacy branch/PR create).
 *   fix — targeted fix prompt from speckit-state + INPUT_PROMPT → input_prompt.md
 *
 * Environment — common:
 *   GITHUB_TOKEN or COPILOT_PAT, GITHUB_REPOSITORY, DEVELOPER_AGENT_MODEL
 *
 * Environment — speckit:
 *   ISSUE_NUMBER, ISSUE_KEY, STEP, BRANCH_NAME — same ref the workflow checked out; optional PR_NUMBER must match state when set
 *
 * Environment — fix:
 *   ISSUE_KEY, INPUT_PROMPT — /fix text for the fix template, or a repo-relative path to a
 *     prompt file (if the path exists as a file, its contents are used as input_prompt.md as-is)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Octokit } from '@octokit/rest';

import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';
import { findSpeckitStateFilePath } from './speckit-state-path.js';
import { tryWriteSpecKitIssueContextFile } from './spec-kit-context/issue-context.js';

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

/* ------------------------------------------------------------------ */
/*  Types (speckit)                                                    */
/* ------------------------------------------------------------------ */

type SpeckitStep =
  | 'specify'
  | 'clarify'
  | 'plan'
  | 'tasks'
  | 'implement'
  | 'code_review';

const STEP_ORDER: SpeckitStep[] = [
  'specify',
  'clarify',
  'plan',
  'tasks',
  'implement',
  'code_review',
];

interface SpeckitState {
  completedSteps: SpeckitStep[];
  nextStep: SpeckitStep | null;
  lastUpdated: string;
  issueNumber: number;
  issueKey: string;
  prNumber: number;
  branchName: string;
  featureDir?: string;
}

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

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
  console.log(`[dev-agent-setup] output: ${name}=${value}`);
}

function extractPipelineConfig(issueBody: string): PipelineConfig {
  const match = issueBody.match(/<!--sdlc-pipeline-config\s*([\s\S]*?)\s*\/sdlc-pipeline-config-->/);
  if (!match) {
    throw new Error(
      'Could not find <!--sdlc-pipeline-config ... /sdlc-pipeline-config--> block in issue body',
    );
  }
  return JSON.parse(match[1]) as PipelineConfig;
}

function parseSpeckitStep(raw: string): SpeckitStep {
  const s = raw.trim().toLowerCase().replace(/-/g, '_') as SpeckitStep;
  if (!STEP_ORDER.includes(s)) {
    throw new Error(`Unknown STEP "${raw}". Expected one of: ${STEP_ORDER.join(', ')}`);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Speckit setup                                                      */
/* ------------------------------------------------------------------ */

async function runSpeckitSetup(): Promise<void> {
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
        `[dev-agent-setup] specify: using speckit-state at ${statePathEarly} — PR #${prNumber}`,
      );
    } else {
      const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
      const defaultBranch = repoInfo.default_branch;
      const remoteRef = git(`ls-remote --heads origin ${branchName}`);

      if (remoteRef.length > 0) {
        git(`fetch origin ${branchName}`);
        git(`checkout -B ${branchName} origin/${branchName}`);
        console.log(`[dev-agent-setup] Switched to existing branch ${branchName}`);

        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          head: `${owner}:${branchName}`,
          state: 'open',
        });
        if (prs.length > 0) {
          prNumber = prs[0].number;
          console.log(`[dev-agent-setup] Using existing PR #${prNumber}`);
        } else {
          const { data: issueData } = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
          });
          const { data: pr } = await octokit.rest.pulls.create({
            owner,
            repo,
            title: issueData.title,
            head: branchName,
            base: defaultBranch,
            draft: true,
            body: `Resolves #${issueNumber}\n\n_Spec-kit pipeline in progress — managed by SDLC Developer Agent._`,
          });
          prNumber = pr.number;
          console.log(`[dev-agent-setup] Created PR #${prNumber} (branch existed, no open PR found)`);
        }
      } else {
        git(`checkout -b ${branchName}`);
        git(`commit --allow-empty -m "chore(${issueKey}): init feature branch"`);
        git(`push origin ${branchName}`);

        const { data: issueData } = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: issueNumber,
        });
        const { data: pr } = await octokit.rest.pulls.create({
          owner,
          repo,
          title: issueData.title,
          head: branchName,
          base: defaultBranch,
          draft: true,
          body: `Resolves #${issueNumber}\n\n_Spec-kit pipeline in progress — managed by SDLC Developer Agent._`,
        });
        prNumber = pr.number;

        await octokit.rest.issues
          .addLabels({ owner, repo, issue_number: prNumber, labels: [`jira:${issueKey}`] })
          .catch(() => {
            /* label may not exist yet */
          });

        console.log(`[dev-agent-setup] Draft PR #${prNumber} created`);
      }
    }
  } else {
    const statePath = findSpeckitStateFilePath(issueKey);
    if (!existsSync(statePath)) throw new Error(`speckit-state.json not found (searched legacy path + find)`);
    const saved = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
    branchName = saved.branchName;
    prNumber = saved.prNumber;
    featureDir = saved.featureDir ?? dirname(statePath);
    console.log(`[dev-agent-setup] Continuing on PR #${prNumber} (branch: ${branchName})`);
  }

  const depthRaw = parseInt(process.env['TICKET_CONTEXT_DEPTH'] ?? '1', 10);
  const ticketContextDepth = !Number.isNaN(depthRaw) && depthRaw >= 0 ? depthRaw : 1;
  await tryWriteSpecKitIssueContextFile({
    issueKey,
    cwd: process.cwd(),
    ticketContextDepth,
  });

  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
  const config = extractPipelineConfig(issue.body ?? '');
  const defaultCodeReviewPrompt = loadTemplate(
    import.meta.url,
    'prompts',
    'code-review-default-input.md',
  );

  const stepInputMap: Record<SpeckitStep, string> = {
    specify: config.specifyInput,
    clarify: config.clarifyInput,
    plan: config.planInput,
    tasks: config.tasksInput,
    implement: config.implementInput,
    code_review: config.codeReviewInput?.trim() || defaultCodeReviewPrompt,
  };
  const input = stepInputMap[step];

  const skillFilePath = `.agents/skills/speckit-${step}/SKILL.md`;
  if (!existsSync(skillFilePath)) {
    throw new Error(
      `Native Codex skill not found: ${skillFilePath}\n` +
        `Run the onboarding workflow to install spec-kit skills into .agents/skills/.`,
    );
  }

  const codexModel = process.env['DEVELOPER_AGENT_MODEL']?.trim() || 'o4-mini';
  const promptContent = `$speckit-${step} ${input}`;

  mkdirSync('.sdlc-agents', { recursive: true });
  writeFileSync('.sdlc-agents/input_prompt.md', promptContent + '\n');
  console.log(`[dev-agent-setup] Wrote prompt to .sdlc-agents/input_prompt.md`);

  setOutput('branch_name', branchName);
  setOutput('pr_number', String(prNumber));
  setOutput('feature_dir', featureDir);
  setOutput('codex_model', codexModel);

  console.log(`[dev-agent-setup] Setup complete — step=${step} branch=${branchName} pr=#${prNumber}`);
}

/* ------------------------------------------------------------------ */
/*  Fix setup                                                          */
/* ------------------------------------------------------------------ */

async function runFixSetup(): Promise<void> {
  const token = process.env['COPILOT_PAT'] ?? process.env['GITHUB_TOKEN'] ?? '';
  const repository = process.env['GITHUB_REPOSITORY'] ?? '';
  const issueKey = requireEnv('ISSUE_KEY');
  let fixInstructions = requireEnv('INPUT_PROMPT').replace(/^\s*\/fix\s*/, '');
  const codexModel = process.env['DEVELOPER_AGENT_MODEL']?.trim() || 'o4-mini';

  const statePath = findSpeckitStateFilePath(issueKey);
  if (!existsSync(statePath)) {
    throw new Error(`speckit-state.json not found for ${issueKey} (searched legacy path + find)`);
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as FixSpeckitState;
  const featureDir = state.featureDir ?? dirname(statePath);

  // Same PR branch / PR # as spec-kit recorded — job outputs match speckit (Codex always checks out this branch).
  setOutput('branch_name', state.branchName);
  setOutput('pr_number', String(state.prNumber));

  console.log(`[dev-agent-setup] fix: featureDir=${featureDir} model=${codexModel}`);

  const pathCandidate = fixInstructions.trim();
  if (pathCandidate && existsSync(pathCandidate) && statSync(pathCandidate).isFile()) {
    const body = readFileSync(pathCandidate, 'utf8');
    mkdirSync('.sdlc-agents', { recursive: true });
    writeFileSync('.sdlc-agents/input_prompt.md', body.endsWith('\n') ? body : `${body}\n`);
    console.log(`[dev-agent-setup] fix: copied prompt from file ${pathCandidate}`);
    setOutput('feature_dir', featureDir);
    setOutput('codex_model', codexModel);
    console.log('[dev-agent-setup] fix: setup complete (raw prompt file)');
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
      console.log(`[dev-agent-setup] fix: fetched issue #${issueNumber}: "${issue.title}"`);
    } catch (err) {
      console.warn('[dev-agent-setup] fix: could not fetch issue (non-fatal):', err);
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

  mkdirSync('.sdlc-agents', { recursive: true });
  writeFileSync('.sdlc-agents/input_prompt.md', prompt + '\n');
  console.log(
    `[dev-agent-setup] fix: wrote prompt to .sdlc-agents/input_prompt.md (${prompt.length} chars)`,
  );

  setOutput('feature_dir', featureDir);
  setOutput('codex_model', codexModel);

  console.log('[dev-agent-setup] fix: setup complete');
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
  console.error('[dev-agent-setup] Fatal error:', err);
  process.exit(1);
});
