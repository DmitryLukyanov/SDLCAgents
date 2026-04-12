/**
 * Developer Agent — Teardown phase.
 *
 * Runs AFTER openai/codex-action@v1 in the workflow.
 *
 * Responsibilities:
 *  1. Stage all Codex-written files (git add -A, excluding .sdlc-agents)
 *  2. Discover featureDir from staged paths (specify step) or use FEATURE_DIR env
 *  3. Commit artifacts
 *  4. Write/update speckit-state.json
 *  5. Commit speckit-state.json + push
 *  6. On "implement" and "code_review": mark PR ready for review (draft: false), right after push
 *  7. Write GitHub Actions job summary
 *  8. Post PR comment
 *
 * Environment variables (set by _reusable-developer-agent.yml):
 *   GITHUB_TOKEN                 — ${{ github.token }} for PR comments and mark-ready-for-review (GraphQL)
 *   COPILOT_PAT                  — optional; used only if GITHUB_TOKEN cannot clear draft (same repo secret)
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   ISSUE_NUMBER                 — GitHub issue number
 *   ISSUE_KEY                    — Jira issue key
 *   STEP                         — spec-kit step that just ran
 *   BRANCH_NAME                  — feature branch name (from setup outputs)
 *   PR_NUMBER                    — PR number (from setup outputs)
 *   FEATURE_DIR                  — artifacts dir (from setup outputs; empty for specify)
 *   CODEX_OUTPUT_FILE            — path to the Codex output file (from codex-action output-file)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

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

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

const STEP_COMPLETE_TEMPLATE         = loadTemplate(import.meta.url, 'templates', 'pr-comment-step-completed.md');
const IMPLEMENT_COMPLETE_TEMPLATE    = loadTemplate(import.meta.url, 'templates', 'pr-comment-implement-completed.md');
const CODE_REVIEW_COMPLETE_TEMPLATE  = loadTemplate(import.meta.url, 'templates', 'pr-comment-code-review-completed.md');
const JOB_SUMMARY_STEP_TEMPLATE     = loadTemplate(import.meta.url, 'templates', 'job-summary-step.md');

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
      console.warn(`[dev-agent-teardown] PR comment failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s…`, err);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

function nextStepAfter(step: SpeckitStep): SpeckitStep | null {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}

function stepLabel(step: SpeckitStep): string {
  return `${step} (${STEP_ORDER.indexOf(step) + 1}/${STEP_ORDER.length})`;
}

/** Normalize workflow_dispatch `STEP` (trim, lowercase, hyphen → underscore). */
function parseSpeckitStep(raw: string): SpeckitStep {
  const s = raw.trim().toLowerCase().replace(/-/g, '_') as SpeckitStep;
  if (!STEP_ORDER.includes(s)) {
    throw new Error(`Unknown STEP "${raw}". Expected one of: ${STEP_ORDER.join(', ')}`);
  }
  return s;
}

function graphqlUrl(): string {
  return process.env['GITHUB_GRAPHQL_URL']?.trim() || 'https://api.github.com/graphql';
}

/**
 * Mark a draft PR ready for review via GraphQL.
 * REST `PATCH .../pulls/{n}` does not document `draft`; GitHub may ignore `draft: false` on that
 * endpoint while still returning 200 — so we use `markPullRequestReadyForReview` like `gh pr ready`.
 */
async function markPullRequestReadyGraphql(token: string, pullRequestNodeId: string): Promise<{ ok: boolean; errors?: string }> {
  const res = await fetch(graphqlUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SDLCAgents-developer-agent-teardown',
    },
    body: JSON.stringify({
      query: `
        mutation MarkReady($id: ID!) {
          markPullRequestReadyForReview(input: { pullRequestId: $id }) {
            pullRequest { isDraft }
          }
        }
      `,
      variables: { id: pullRequestNodeId },
    }),
  });
  if (!res.ok) {
    return { ok: false, errors: `GraphQL HTTP ${res.status}` };
  }
  const json = (await res.json()) as {
    errors?: Array<{ message: string }>;
    data?: { markPullRequestReadyForReview?: { pullRequest?: { isDraft: boolean | null } } | null };
  };
  if (json.errors?.length) {
    const msg = json.errors.map(e => e.message).join('; ');
    // Already ready / not draft — caller verifies with REST `pulls.get`.
    if (/already\s+ready|not\s+a\s+draft|cannot\s+mark.*ready/i.test(msg)) {
      return { ok: true };
    }
    return { ok: false, errors: msg };
  }
  return { ok: true };
}

/** Clear draft on the PR (GraphQL). Optional `COPILOT_PAT` if `GITHUB_TOKEN` cannot mark ready. */
async function markPullNonDraft(owner: string, repo: string, prNumber: number): Promise<void> {
  const githubToken = requireEnv('GITHUB_TOKEN');
  const pat = process.env['COPILOT_PAT']?.trim() || '';

  const getPr = async (token: string) => {
    const o = new Octokit({ auth: token });
    return o.rest.pulls.get({ owner, repo, pull_number: prNumber });
  };

  let { data: pr } = await getPr(githubToken);
  if (!pr.draft) {
    console.log(`[dev-agent-teardown] PR #${prNumber} already ready for review`);
    return;
  }

  const tryAuth = async (token: string, label: string): Promise<boolean> => {
    const gql = await markPullRequestReadyGraphql(token, pr.node_id);
    if (!gql.ok) {
      console.warn(`[dev-agent-teardown] markPullRequestReadyForReview (${label}) failed: ${gql.errors ?? 'unknown'}`);
    }
    // Short pause — GitHub occasionally lags between mutation and REST `draft`.
    await new Promise(r => setTimeout(r, 1500));
    const { data } = await getPr(token);
    if (!data.draft) {
      console.log(`[dev-agent-teardown] PR #${prNumber} ready for review (draft=false, verified via ${label})`);
      return true;
    }
    return false;
  };

  if (await tryAuth(githubToken, 'GITHUB_TOKEN')) return;
  if (pat && pat !== githubToken) {
    if (await tryAuth(pat, 'COPILOT_PAT')) return;
  }

  throw new Error(
    `PR #${prNumber} is still draft after markPullRequestReadyForReview ` +
    `(tried GITHUB_TOKEN${pat ? ' and COPILOT_PAT' : ''}). ` +
    'Ensure the job has permissions `contents: write` and `pull-requests: write`, ' +
    'and that any workflow calling this reusable workflow passes those permissions through.',
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const repository     = requireEnv('GITHUB_REPOSITORY');
  const issueNumber    = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey       = requireEnv('ISSUE_KEY');
  const step           = parseSpeckitStep(requireEnv('STEP'));
  const branchName     = requireEnv('BRANCH_NAME');
  const prNumberRaw    = requireEnv('PR_NUMBER');
  const prNumber       = parseInt(prNumberRaw, 10);
  if (!Number.isFinite(prNumber) || prNumber < 1) {
    throw new Error(`Invalid PR_NUMBER: ${JSON.stringify(prNumberRaw)}`);
  }
  let featureDir       = process.env['FEATURE_DIR']?.trim() || '';
  const codexOutputFile = process.env['CODEX_OUTPUT_FILE']?.trim() || '';

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

  // ── 1. Stage everything Codex may have written ───────────────────
  // Use git add -A (excluding the SDLCAgents checkout and node_modules)
  // so we capture any path Codex chose to write to.
  const gitStatus = git('status --short');
  console.log(`[dev-agent-teardown] git status after Codex:\n${gitStatus || '(clean)'}`);

  try {
    git('add -A -- ":!.sdlc-agents" ":!node_modules"');
  } catch { /* non-fatal */ }

  const stagedFiles = git('diff --cached --name-only');
  console.log(`[dev-agent-teardown] Staged files:\n${stagedFiles || '(none)'}`);

  // ── 2. Discover featureDir (specify step only) ───────────────────
  if (!featureDir) {
    for (const f of stagedFiles.split('\n').filter(Boolean)) {
      const m = f.match(/^(specs\/[^/]+\/|\.specify\/features\/[^/]+\/)/);
      if (m) { featureDir = m[1].replace(/\/$/, ''); break; }
    }
    featureDir ||= `.specify/features/${issueKey}`;
  }

  // Codex output is uploaded as a separate artifact — no need to embed it
  // in the job summary (doing so caused the </details> closing tag to appear
  // as a visible heading when the output contained markdown / code fences).

  // ── 3. Commit artifacts ──────────────────────────────────────────
  let artifactCommitSha = '';
  if (stagedFiles) {
    git(`commit -m "speckit(${step}): add ${step} artifacts for ${issueKey}"`);
    artifactCommitSha = git('rev-parse HEAD');
  } else {
    console.warn('[dev-agent-teardown] No artifact changes after skill execution');
  }

  // ── 4. Write + commit speckit-state.json ─────────────────────────
  const statePath = join(featureDir, 'speckit-state.json');
  const completedSteps: SpeckitStep[] = existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState).completedSteps
    : [];
  if (!completedSteps.includes(step)) completedSteps.push(step);

  const state: SpeckitState = {
    completedSteps,
    nextStep:    nextStepAfter(step),
    lastUpdated: new Date().toISOString(),
    issueNumber,
    issueKey,
    prNumber,
    branchName,
    featureDir,
  };
  mkdirSync(dirname(statePath), { recursive: true }); // featureDir may be the fallback path
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  git(`add ${statePath}`);
  git(`commit -m "speckit(${step}): update speckit-state.json"`);
  const stateCommitSha = git('rev-parse HEAD');
  git(`push origin ${branchName}`);
  console.log(`[dev-agent-teardown] Pushed. nextStep=${state.nextStep ?? 'null (all done)'}`);

  // ── 5. Mark PR ready (non-draft) after implement / code_review — immediately after
  // push so PR comment or summary failures cannot skip this step.
  if (step === 'implement' || step === 'code_review') {
    await markPullNonDraft(owner, repo, prNumber);
  }

  // ── 6. Write GitHub Actions job summary ─────────────────────────
  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repoUrl   = `${serverUrl}/${owner}/${repo}`;

  const changedPaths = stagedFiles ? stagedFiles.split('\n').filter(Boolean) : [];
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

  appendSummary(fillTemplate(JOB_SUMMARY_STEP_TEMPLATE, {
    STEP:         step,
    STEP_INDEX:   String(STEP_ORDER.indexOf(step) + 1),
    STEP_TOTAL:   String(STEP_ORDER.length),
    ISSUE_KEY:    issueKey,
    FEATURE_DIR:  featureDir,
    FILES_TABLE:  filesTable,
    COMMITS_MD:   commits.map(c => `- ${c}`).join('\n'),
    PR_NUMBER:    String(prNumber),
    PR_URL:       `${repoUrl}/pull/${prNumber}`,
  }));

  // ── 7. Post PR comment ──────────────────────────────────────────
  const next    = state.nextStep;
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
    : step === 'code_review'
      ? fillTemplate(CODE_REVIEW_COMPLETE_TEMPLATE, {
          STEP_LABEL: stepLabel(step),
          RUN_LINK:   runLink,
        })
      : fillTemplate(IMPLEMENT_COMPLETE_TEMPLATE, {
          STEP_LABEL: stepLabel(step),
          RUN_LINK:   runLink,
        });

  await postComment(octokitComment, owner, repo, prNumber, commentBody);

  console.log(`[dev-agent-teardown] Step "${step}" complete.`);
}

main().catch((err) => {
  console.error('[dev-agent-teardown] Fatal error:', err);
  process.exit(1);
});
