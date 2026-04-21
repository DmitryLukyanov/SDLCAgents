/**
 * Developer Agent — Fix Teardown phase.
 *
 * Runs AFTER the dedicated Codex job (workspace tarball applied) in the fix workflow.
 *
 * Responsibilities:
 *  1. Stage all Codex-written files (git add -A, excluding .sdlc-agents)
 *  2. Commit artifact changes (if any)
 *  3. Touch speckit-state.json (lastFixedAt) → triggers spec gate re-validation
 *  4. Commit state + push
 *  5. Write GitHub Actions job summary
 *  6. Post PR comment
 *
 * Environment variables (set by _reusable-developer-agent-fix.yml):
 *   GITHUB_TOKEN                 — ${{ github.token }} for issues.createComment only (github-actions[bot])
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   ISSUE_KEY                    — Jira issue key
 *   PR_NUMBER                    — PR number
 *   BRANCH_NAME                  — feature branch name
 *   FIX_INSTRUCTIONS             — the fix instructions (for summary)
 *   CODEX_OUTPUT_FILE            — path to the Codex output file
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

const FIX_APPLIED_TEMPLATE     = loadTemplate(import.meta.url, 'templates', 'pr-comment-fix-applied.md');
const JOB_SUMMARY_FIX_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'job-summary-fix.md');

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

function appendSummary(md: string): void {
  const f = process.env['GITHUB_STEP_SUMMARY'];
  if (f) appendFileSync(f, md + '\n');
}

function commitLink(sha: string, repoUrl: string, label: string): string {
  return `[\`${sha.slice(0, 7)}\`](${repoUrl}/commit/${sha}) — ${label}`;
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
      console.warn(`[dev-agent-fix-teardown] PR comment failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s…`, err);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
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

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const repository      = requireEnv('GITHUB_REPOSITORY');
  const issueKey        = requireEnv('ISSUE_KEY');
  const prNumber        = parseInt(requireEnv('PR_NUMBER'), 10);
  const branchName      = requireEnv('BRANCH_NAME');
  const fixInstructions = process.env['FIX_INSTRUCTIONS'] || '';
  const codexOutputFile = process.env['CODEX_OUTPUT_FILE']?.trim() || '';

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

  // ── 1. Stage everything Codex may have written ───────────────────
  const gitStatus = git('status --short');
  console.log(`[dev-agent-fix-teardown] git status after Codex:\n${gitStatus || '(clean)'}`);

  try {
    git('add -A -- ":!.sdlc-agents" ":!node_modules"');
  } catch { /* non-fatal */ }

  const stagedFiles = git('diff --cached --name-only');
  console.log(`[dev-agent-fix-teardown] Staged files:\n${stagedFiles || '(none)'}`);

  // ── 2. Surface Codex output in the job summary ───────────────────
  if (codexOutputFile && existsSync(codexOutputFile)) {
    const codexOutput = readFileSync(codexOutputFile, 'utf8').trim();
    if (codexOutput) {
      appendSummary([
        '<details><summary>Codex output</summary>',
        '',
        '```',
        codexOutput,
        '```',
        '',
        '</details>',
      ].join('\n'));
    }
  }

  // ── 3. Commit artifact changes ────────────────────────────────────
  const changedPaths = stagedFiles ? stagedFiles.split('\n').filter(Boolean) : [];
  let artifactCommitSha = '';
  if (stagedFiles) {
    git(`commit -m "speckit(fix): apply targeted fixes for ${issueKey}"`);
    artifactCommitSha = git('rev-parse HEAD');
  } else {
    console.warn('[dev-agent-fix-teardown] No artifact changes (Codex made no edits)');
  }

  // ── 4. Touch speckit-state.json → triggers spec gate re-validation ─
  const statePath = findStateFilePath(issueKey);
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
  state['lastFixedAt'] = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  git(`add ${statePath}`);
  git(`commit -m "speckit(fix): trigger spec gate re-validation for ${issueKey}"`);
  const stateCommitSha = git('rev-parse HEAD');

  // ── 5. Push ───────────────────────────────────────────────────────
  git(`push origin ${branchName}`);
  console.log('[dev-agent-fix-teardown] Pushed — spec gate will re-validate');

  // ── 6. Write GitHub Actions job summary ──────────────────────────
  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repoUrl   = `${serverUrl}/${owner}/${repo}`;

  const filesTable = changedPaths.length > 0
    ? [
        '| File | Size |',
        '|------|------|',
        ...changedPaths.map(p => {
          const size = existsSync(p) ? `${statSync(p).size} B` : '—';
          return `| \`${p}\` | ${size} |`;
        }),
      ].join('\n')
    : '_No artifact changes detected (Codex made no edits)_';

  const commits: string[] = [];
  if (artifactCommitSha) commits.push(commitLink(artifactCommitSha, repoUrl, `speckit(fix): apply targeted fixes for ${issueKey}`));
  commits.push(commitLink(stateCommitSha, repoUrl, `speckit(fix): trigger spec gate re-validation for ${issueKey}`));

  appendSummary(fillTemplate(JOB_SUMMARY_FIX_TEMPLATE, {
    ISSUE_KEY:         issueKey,
    FIX_INSTRUCTIONS:  fixInstructions,
    FILES_TABLE:       filesTable,
    COMMITS_MD:        commits.map(c => `- ${c}`).join('\n'),
    PR_NUMBER:         String(prNumber),
    PR_URL:            `${repoUrl}/pull/${prNumber}`,
  }));

  // ── 7. Post PR comment ────────────────────────────────────────────
  const runId   = process.env['GITHUB_RUN_ID'];
  const runLink = runId
    ? `\n\n<sub>Produced by [workflow run](${repoUrl}/actions/runs/${runId})</sub>`
    : '';

  await postComment(octokitComment, owner, repo, prNumber, fillTemplate(FIX_APPLIED_TEMPLATE, {
    BRANCH_NAME: branchName,
    RUN_LINK:    runLink,
  }));

  console.log('[dev-agent-fix-teardown] Fix complete.');
}

main().catch((err) => {
  console.error('[dev-agent-fix-teardown] Fatal error:', err);
  process.exit(1);
});
