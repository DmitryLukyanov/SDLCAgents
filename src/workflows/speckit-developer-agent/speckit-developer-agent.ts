/**
 * SpecKit Developer Agent — legacy monolithic entry point (SUPERSEDED).
 *
 * ⚠️  This file is no longer called by _reusable-speckit-developer-agent.yml.
 *     The workflow uses prepare / dedicated Codex job / teardown:
 *       speckit-developer-agent-setup.ts    → creates branch/PR, writes prompt file
 *       _reusable-codex-run.yml             → runs Codex skill
 *       speckit-developer-agent-teardown.ts → stages files, commits, pushes, comments
 *     Kept for reference only.
 *
 * Executes a single spec-kit step on behalf of the speckit developer agent workflow.
 * Runs after AI Teammate dispatches the first step ("specify"), and is
 * re-dispatched by the proceed workflow after each subsequent step.
 *
 * Responsibilities per invocation:
 *   1. On "specify": create feature branch + open draft PR
 *   2. Read the GitHub issue body to extract the pipeline config JSON
 *   3. Run the current spec-kit step via native Codex skill (CI-safe):
 *      `codex exec --model <m> --full-auto --sandbox workspace-write -- '$speckit-{step} <input>'`
 *      (`exec` = non-interactive, like openai/codex-action; `$` invokes the spec-kit skill.)
 *   4. Commit artifacts written by Codex to the feature branch
 *   5. Write/update speckit-state.json (commit it — triggers spec gate)
 *   6. Post a summary comment on the PR
 *   7. On "implement": mark PR ready for review
 *
 * Environment variables (set by _reusable-speckit-developer-agent.yml):
 *   GITHUB_TOKEN or COPILOT_PAT      — GitHub API token
 *   GITHUB_REPOSITORY                — "owner/repo"
 *   ISSUE_NUMBER                     — GitHub issue number (string)
 *   ISSUE_KEY                        — Jira issue key (e.g. "PROJ-1")
 *   STEP                             — spec-kit step to run
 *   DEVELOPER_AGENT_MODEL            — Codex model for all spec-kit steps (required - must be set via config or env)
 */

import { execSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
import { findSpeckitStateFilePath } from './speckit-state-path.js';

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
  /** Absolute or repo-relative path to the artifacts directory.
   *  Set by the specify step. Subsequent steps read this so that the
   *  actual location (e.g. `specs/001-auth/`) is always authoritative. */
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

// PR comment templates
const STEP_COMPLETE_TEMPLATE      = loadTemplate(import.meta.url, 'templates', 'pr-comment-step-completed.md');
const IMPLEMENT_COMPLETE_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'pr-comment-implement-completed.md');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function appendSummary(md: string): void {
  const f = process.env['GITHUB_STEP_SUMMARY'];
  if (f) appendFileSync(f, md + '\n');
}

function commitLink(sha: string, repoUrl: string, label: string): string {
  return `[\`${sha.slice(0, 7)}\`](${repoUrl}/commit/${sha}) — ${label}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/** Post a GitHub issue comment with automatic retry on transient network errors. */
async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issue_number: number,
  body: string,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delayMs = attempt * 3000; // 3 s, 6 s
      console.warn(`[dev-agent] PR comment failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s…`, err);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

function stepInput(config: PipelineConfig, step: SpeckitStep): string {
  const defaultCodeReview =
    'Review the implementation on this branch against tasks.md and spec.md. ' +
    'Write code-review-summary.md and .code-review-verdict (APPROVED or CHANGES_NEEDED) at the repo root; fix clear issues in code when safe.';
  const map: Record<SpeckitStep, string> = {
    specify:     config.specifyInput,
    clarify:     config.clarifyInput,
    plan:        config.planInput,
    tasks:       config.tasksInput,
    implement:   config.implementInput,
    code_review: config.codeReviewInput?.trim() || defaultCodeReview,
  };
  return map[step];
}

function nextStepAfter(step: SpeckitStep): SpeckitStep | null {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}

function stepLabel(step: SpeckitStep): string {
  return `${step} (${STEP_ORDER.indexOf(step) + 1}/${STEP_ORDER.length})`;
}

/** Extract the JSON pipeline config block from the GitHub issue body.
 *
 * The block is wrapped in HTML comment sentinels rather than a markdown
 * code fence to avoid ``` inside BA results breaking the regex early.
 *
 *   <!--sdlc-pipeline-config
 *   { ... }
 *   /sdlc-pipeline-config-->
 */
function extractPipelineConfig(issueBody: string): PipelineConfig {
  const match = issueBody.match(/<!--sdlc-pipeline-config\s*([\s\S]*?)\s*\/sdlc-pipeline-config-->/);
  if (!match) throw new Error('Could not find `<!--sdlc-pipeline-config ... /sdlc-pipeline-config-->` block in issue body');
  return JSON.parse(match[1]) as PipelineConfig;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const token = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey = requireEnv('ISSUE_KEY');
  const step = requireEnv('STEP') as SpeckitStep;

  if (!STEP_ORDER.includes(step)) {
    throw new Error(`Unknown step: "${step}". Valid: ${STEP_ORDER.join(', ')}`);
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit = new Octokit({ auth: token });

  // Branch name resolution:
  //   - Non-specify steps: always read from speckit-state.json (written by specify).
  //   - Specify step, fresh run: generate a unique name with the current epoch ms.
  //   - Specify step, /fix re-run: BRANCH_NAME env var is set by the reusable
  //     workflow (read from speckit-state.json by the fix handler) — reuse it so
  //     we stay on the existing branch and PR instead of creating new ones.
  const branchName = step === 'specify'
    ? (process.env['BRANCH_NAME']?.trim() || `feature/${issueKey}-${Date.now()}`)
    : (() => {
        const statePath = findSpeckitStateFilePath(issueKey);
        if (!existsSync(statePath)) throw new Error(`speckit-state.json not found (searched legacy + find)`);
        return (JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState).branchName;
      })();

  console.log(`[dev-agent] step=${step} issue=#${issueNumber} key=${issueKey}`);

  // ── 1. Create branch + draft PR on first step ────────────────────
  let prNumber: number;

  if (step === 'specify') {
    const defaultBranch = git('rev-parse --abbrev-ref HEAD');

    // Check if the remote feature branch already exists (idempotency / re-run support)
    const remoteRef = git(`ls-remote --heads origin ${branchName}`).trim();
    const branchAlreadyExists = remoteRef.length > 0;

    if (branchAlreadyExists) {
      // Re-run: fetch the existing branch and switch to it
      git(`fetch origin ${branchName}`);
      git(`checkout -B ${branchName} origin/${branchName}`);
      console.log(`[dev-agent] Feature branch ${branchName} already exists — switching to it`);

      // Find the existing open PR for this branch
      const { data: prs } = await octokit.rest.pulls.list({
        owner, repo, head: `${owner}:${branchName}`, state: 'open',
      });
      if (prs.length > 0) {
        prNumber = prs[0].number;
        console.log(`[dev-agent] Using existing PR #${prNumber}`);
      } else {
        // Branch exists but no open PR — create one
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
        console.log(`[dev-agent] Created PR #${prNumber} (branch existed, no open PR found)`);
      }
    } else {
      // Fresh start: create branch, make an empty commit so GitHub accepts the PR,
      // push, then open a draft PR.
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

      console.log(`[dev-agent] Draft PR #${prNumber} created`);
    }
  } else {
    const statePath = findSpeckitStateFilePath(issueKey);
    if (!existsSync(statePath)) throw new Error(`speckit-state.json not found (searched legacy + find)`);
    const saved = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
    prNumber = saved.prNumber;
    console.log(`[dev-agent] Continuing on PR #${prNumber} (branch: ${branchName})`);
  }

  // ── 2. Read issue body + extract pipeline config ─────────────────
  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
  const config = extractPipelineConfig(issue.body ?? '');
  const input = stepInput(config, step);

  // ── 3–7. Execute spec-kit step via native Codex skill ───────────
  //
  // spec-kit installs skills into .agents/skills/speckit-{step}/SKILL.md (validated below).
  // Invoked like: codex exec --full-auto --sandbox workspace-write -- '$speckit-{step} <input>'
  // Codex writes files in the workspace; featureDir is discovered from staged paths.

  const skillFilePath = `.agents/skills/speckit-${step}/SKILL.md`;
  if (!existsSync(skillFilePath)) {
    throw new Error(
      `Native Codex skill not found: ${skillFilePath}\n` +
      `Run the onboarding workflow to install spec-kit skills into .agents/skills/.`,
    );
  }

  // featureDir for non-specify steps: read from persisted state.
  // For specify: discovered after Codex writes files (unknown in advance).
  let featureDir: string =
    step !== 'specify'
      ? (() => {
          const sp = findSpeckitStateFilePath(issueKey);
          const saved = JSON.parse(readFileSync(sp, 'utf8')) as SpeckitState;
          return saved.featureDir ?? dirname(sp);
        })()
      : ''; // discovered below after Codex runs

  let stagedFiles = '';
  let artifactCommitSha = '';
  const promptSource = `native Codex skill (\`${skillFilePath}\`)`;

  const codexModel = process.env['DEVELOPER_AGENT_MODEL']?.trim();
  if (!codexModel) {
    throw new Error(
      'DEVELOPER_AGENT_MODEL environment variable must be set. ' +
      'Configure it in your agent config file (params.model) or set the environment variable explicitly.'
    );
  }

  // `codex exec` is the non-interactive subcommand designed for CI (no TTY needed).
  // `--dangerously-bypass-approvals-and-sandbox` lets Codex write to the workspace
  // without pausing for approval — equivalent to `--sandbox workspace-write` in
  // interactive mode but works headless.
  const skillInvocation = `$speckit-${step} ${input}`;
  const combinedPrompt = `codex exec --dangerously-bypass-approvals-and-sandbox --model ${codexModel} '${skillInvocation}'`;
  console.log(`[dev-agent] Running: ${combinedPrompt}`);

  const codexResult = spawnSync(
    'codex',
    ['exec', '--dangerously-bypass-approvals-and-sandbox', '--model', codexModel, skillInvocation],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600_000, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const codexStdout = codexResult.stdout ?? '';
  const codexStderr = codexResult.stderr ?? '';
  if (codexStderr) console.log(`[dev-agent][codex stderr]\n${codexStderr}`);
  console.log(`[dev-agent][codex stdout] ${codexStdout.length} chars`);
  if (codexResult.error) throw new Error(`Codex skill failed to start: ${codexResult.error.message}`);
  if (codexResult.status !== 0) {
    throw new Error(`Codex skill exited with code ${codexResult.status}\nstderr: ${codexStderr.slice(0, 1000)}`);
  }

  // Stage everything Codex may have written. Use `git add -A` (excluding the
  // .sdlc-agents checkout) so we catch any path Codex chose to write to,
  // not just the conventional spec-kit directories.
  const gitStatus = git('status --short || true');
  console.log(`[dev-agent] git status after Codex:\n${gitStatus || '(clean)'}`);
  git('add -A -- ":!.sdlc-agents" ":!node_modules" || true');
  stagedFiles = git('diff --cached --name-only');
  console.log(`[dev-agent] Staged files:\n${stagedFiles || '(none)'}`);

  if (!featureDir) {
    for (const f of stagedFiles.split('\n').filter(Boolean)) {
      const m = f.match(/^(specs\/[^/]+\/|\.specify\/features\/[^/]+\/)/);
      if (m) { featureDir = m[1].replace(/\/$/, ''); break; }
    }
    featureDir ||= `.specify/features/${issueKey}`;
  }

  // Always surface Codex stdout in the job summary for visibility.
  if (codexStdout.trim()) {
    appendSummary([
      '<details><summary>Codex stdout</summary>',
      '',
      '```',
      codexStdout.trim(),
      '```',
      '',
      '</details>',
    ].join('\n'));
  }

  if (stagedFiles) {
    git(`commit -m "speckit(${step}): add ${step} artifacts for ${issueKey}"`);
    artifactCommitSha = git('rev-parse HEAD');
  } else {
    console.warn('[dev-agent] No artifact changes after skill execution');
  }

  // ── 8. Write + commit speckit-state.json ─────────────────────────
  const statePath = join(featureDir, 'speckit-state.json');
  const completedSteps: SpeckitStep[] = existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState).completedSteps
    : [];
  if (!completedSteps.includes(step)) completedSteps.push(step);

  const state: SpeckitState = {
    completedSteps,
    nextStep: nextStepAfter(step),
    lastUpdated: new Date().toISOString(),
    issueNumber,
    issueKey,
    prNumber,
    branchName,
    featureDir, // persisted so subsequent steps know the real artifacts location
  };
  mkdirSync(dirname(statePath), { recursive: true }); // ensure dir exists (featureDir may be the fallback path)
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  git(`add ${statePath}`);
  git(`commit -m "speckit(${step}): update speckit-state.json"`);
  const stateCommitSha = git('rev-parse HEAD');
  git(`push origin ${branchName}`);
  console.log(`[dev-agent] Pushed. nextStep=${state.nextStep ?? 'null (all done)'}`);

  // ── 9. Write GitHub Actions job summary ─────────────────────────
  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repoUrl   = `${serverUrl}/${owner}/${repo}`;

  const changedPaths = stagedFiles
    ? stagedFiles.split('\n').filter(Boolean)
    : [];
  const filesTable = changedPaths.length > 0
    ? [
        '| File | Size |',
        '|------|------|',
        ...changedPaths.map(p => {
          const size = existsSync(p) ? `${statSync(p).size} B` : '—';
          return `| \`${p}\` | ${size} |`;
        }),
      ].join('\n')
    : '_No artifact changes detected_';

  const commits: string[] = [];
  if (artifactCommitSha) commits.push(commitLink(artifactCommitSha, repoUrl, `speckit(${step}): add ${step} artifacts for ${issueKey}`));
  commits.push(commitLink(stateCommitSha, repoUrl, `speckit(${step}): update speckit-state.json`));

  appendSummary([
    `# Spec-Kit · \`${step}\` (${STEP_ORDER.indexOf(step) + 1}/${STEP_ORDER.length}) — ${issueKey}`,
    '',
    '## Execution',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Mode | **native Codex skill** (\`codex exec --full-auto --sandbox workspace-write -- $speckit-${step}\`) |`,
    `| Prompt source | ${promptSource} |`,
    `| Feature dir | \`${featureDir}\` |`,
    ...(combinedPrompt ? [
      '',
      `<details><summary>Command · ${combinedPrompt.length} chars</summary>`,
      '',
      '```',
      combinedPrompt,
      '```',
      '',
      '</details>',
    ] : []),
    '',
    '## Files Written',
    '',
    filesTable,
    '',
    '## Commits',
    '',
    commits.map(c => `- ${c}`).join('\n'),
    '',
    '## Pull Request',
    '',
    `[PR #${prNumber}](${repoUrl}/pull/${prNumber})`,
  ].join('\n'));

  // ── 10. Post PR comment ──────────────────────────────────────────
  const next = state.nextStep;
  const runUrl  = process.env['GITHUB_RUN_ID']
    ? `${serverUrl}/${owner}/${repo}/actions/runs/${process.env['GITHUB_RUN_ID']}`
    : '';
  const runLink = runUrl ? `\n\n<sub>Produced by [workflow run](${runUrl})</sub>` : '';

  const commentBody = next
    ? fillTemplate(STEP_COMPLETE_TEMPLATE, {
        STEP:        step,
        STEP_LABEL:  stepLabel(step),
        BRANCH_NAME: branchName,
        NEXT_STEP:   next,
        RUN_LINK:    runLink,
      })
    : fillTemplate(IMPLEMENT_COMPLETE_TEMPLATE, {
        STEP_LABEL: stepLabel(step),
        RUN_LINK:   runLink,
      });

  await postComment(octokit, owner, repo, prNumber, commentBody);

  // ── 11. Mark PR ready on implement ──────────────────────────────
  if (step === 'implement') {
    await octokit.rest.pulls.update({ owner, repo, pull_number: prNumber, draft: false });
    console.log(`[dev-agent] PR #${prNumber} marked ready for review`);
  }

  console.log(`[dev-agent] Step "${step}" complete.`);
}

main().catch((err) => {
  console.error('[dev-agent] Fatal error:', err);
  process.exit(1);
});
