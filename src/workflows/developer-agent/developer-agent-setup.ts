/**
 * Developer Agent — Setup phase.
 *
 * Runs BEFORE openai/codex-action@v1 in the workflow.
 *
 * Responsibilities:
 *  1. On "specify": create feature branch + open draft PR
 *  2. Read GitHub issue body → extract pipeline config
 *  3. Validate that the spec-kit skill file exists
 *  4. Determine Codex model
 *  5. Write "$speckit-{step} {input}" to .sdlc-agents/codex-prompt.md
 *  6. Write to GITHUB_OUTPUT: branch_name, pr_number, feature_dir, codex_model
 *
 * Environment variables (set by _reusable-developer-agent.yml):
 *   GITHUB_TOKEN or COPILOT_PAT        — GitHub API token
 *   GITHUB_REPOSITORY                  — "owner/repo"
 *   ISSUE_NUMBER                       — GitHub issue number (string)
 *   ISSUE_KEY                          — Jira issue key (e.g. "PROJ-1")
 *   STEP                               — spec-kit step to run
 *   BRANCH_NAME                        — existing branch (non-specify steps / /fix re-run)
 *   DEVELOPER_AGENT_MODEL              — Codex model for all spec-kit steps (default: o4-mini)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Octokit } from '@octokit/rest';

import { loadTemplate } from '../../lib/template-utils.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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
  /** Optional extra focus for the automated code_review step */
  codeReviewInput?: string;
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

function findStateFilePath(issueKey: string): string {
  const legacy = `.specify/features/${issueKey}/speckit-state.json`;
  if (existsSync(legacy)) return legacy;

  try {
    const found = execSync(
      `find . -maxdepth 5 -name 'speckit-state.json' -not -path './.git/*' -not -path './.sdlc-agents/*' 2>/dev/null | head -1`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim().replace(/^\.\//, '');
    if (found) return found;
  } catch { /* fall through */ }

  return legacy;
}

function extractPipelineConfig(issueBody: string): PipelineConfig {
  const match = issueBody.match(/<!--sdlc-pipeline-config\s*([\s\S]*?)\s*\/sdlc-pipeline-config-->/);
  if (!match) throw new Error('Could not find <!--sdlc-pipeline-config ... /sdlc-pipeline-config--> block in issue body');
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
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const token       = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository  = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey    = requireEnv('ISSUE_KEY');
  const step = parseSpeckitStep(requireEnv('STEP'));

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit = new Octokit({ auth: token });

  // ── 1. Branch + PR setup ─────────────────────────────────────────
  let branchName: string;
  let prNumber: number;
  let featureDir = '';

  if (step === 'specify') {
    branchName = process.env['BRANCH_NAME']?.trim() || `feature/${issueKey}-${Date.now()}`;
    const defaultBranch = git('rev-parse --abbrev-ref HEAD');
    const remoteRef = git(`ls-remote --heads origin ${branchName}`);

    if (remoteRef.length > 0) {
      // Re-run: existing branch
      git(`fetch origin ${branchName}`);
      git(`checkout -B ${branchName} origin/${branchName}`);
      console.log(`[dev-agent-setup] Switched to existing branch ${branchName}`);

      const { data: prs } = await octokit.rest.pulls.list({
        owner, repo, head: `${owner}:${branchName}`, state: 'open',
      });
      if (prs.length > 0) {
        prNumber = prs[0].number;
        console.log(`[dev-agent-setup] Using existing PR #${prNumber}`);
      } else {
        const { data: issueData } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
        const { data: pr } = await octokit.rest.pulls.create({
          owner, repo,
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
      // Fresh start: create branch, empty commit, push, open draft PR
      git(`checkout -b ${branchName}`);
      git(`commit --allow-empty -m "chore(${issueKey}): init feature branch"`);
      git(`push origin ${branchName}`);

      const { data: issueData } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
      const { data: pr } = await octokit.rest.pulls.create({
        owner, repo,
        title: issueData.title,
        head: branchName,
        base: defaultBranch,
        draft: true,
        body: `Resolves #${issueNumber}\n\n_Spec-kit pipeline in progress — managed by SDLC Developer Agent._`,
      });
      prNumber = pr.number;

      await octokit.rest.issues.addLabels({ owner, repo, issue_number: prNumber, labels: [`jira:${issueKey}`] })
        .catch(() => { /* label may not exist yet */ });

      console.log(`[dev-agent-setup] Draft PR #${prNumber} created`);
    }
  } else {
    const statePath = findStateFilePath(issueKey);
    if (!existsSync(statePath)) throw new Error(`speckit-state.json not found (searched legacy path + find)`);
    const saved = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
    branchName = saved.branchName;
    prNumber   = saved.prNumber;
    featureDir = saved.featureDir ?? dirname(statePath);
    console.log(`[dev-agent-setup] Continuing on PR #${prNumber} (branch: ${branchName})`);
  }

  // ── 2. Read issue body + extract pipeline config ─────────────────
  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
  const config = extractPipelineConfig(issue.body ?? '');
  const defaultCodeReviewPrompt = loadTemplate(
    import.meta.url,
    'templates',
    'code-review-default-input.md',
  );

  const stepInputMap: Record<SpeckitStep, string> = {
    specify:     config.specifyInput,
    clarify:     config.clarifyInput,
    plan:        config.planInput,
    tasks:       config.tasksInput,
    implement:   config.implementInput,
    code_review: (config.codeReviewInput?.trim() || defaultCodeReviewPrompt),
  };
  const input = stepInputMap[step];

  // ── 3. Validate skill file ────────────────────────────────────────
  const skillFilePath = `.agents/skills/speckit-${step}/SKILL.md`;
  if (!existsSync(skillFilePath)) {
    throw new Error(
      `Native Codex skill not found: ${skillFilePath}\n` +
      `Run the onboarding workflow to install spec-kit skills into .agents/skills/.`,
    );
  }

  // ── 4. Determine Codex model ──────────────────────────────────────
  const codexModel = process.env['DEVELOPER_AGENT_MODEL']?.trim() || 'o4-mini';

  // ── 5. Write prompt file ──────────────────────────────────────────
  // Use the Codex skill invocation syntax — Codex discovers the skill from
  // .agents/skills/speckit-{step}/SKILL.md in the consumer repo (installed
  // by the onboarding workflow) and executes it with the provided arguments.
  const promptContent = `$speckit-${step} ${input}`;

  mkdirSync('.sdlc-agents', { recursive: true });
  writeFileSync('.sdlc-agents/codex-prompt.md', promptContent + '\n');
  console.log(`[dev-agent-setup] Wrote prompt to .sdlc-agents/codex-prompt.md`);

  // ── 6. Write GitHub step outputs ─────────────────────────────────
  setOutput('branch_name', branchName);
  setOutput('pr_number',   String(prNumber));
  setOutput('feature_dir', featureDir);
  setOutput('codex_model', codexModel);

  console.log(`[dev-agent-setup] Setup complete — step=${step} branch=${branchName} pr=#${prNumber}`);
}

main().catch((err) => {
  console.error('[dev-agent-setup] Fatal error:', err);
  process.exit(1);
});
