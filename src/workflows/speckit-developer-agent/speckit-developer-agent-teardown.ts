/**
 * Developer Agent — Teardown phase (speckit + fix).
 *
 * Branch on `AGENT_MODE` / `DEVELOPER_AGENT_MODE`:
 *   speckit (default) — update speckit-state progression, mark PR ready when applicable, summary, comment
 *   fix — touch lastFixedAt, push, fix summary, PR comment
 *
 * Environment — common:
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_KEY, PR_NUMBER, BRANCH_NAME
 *
 * Environment — speckit:
 *   ISSUE_NUMBER, STEP, FEATURE_DIR, COPILOT_PAT (optional, mark ready)
 *
 * Environment — fix:
 *   INPUT_PROMPT (optional, workflow `prompt` echoed for job summary)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
import { findSpeckitStateFilePath } from './speckit-state-path.js';

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

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

const STEP_COMPLETE_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'pr-comment-step-completed.md');
const IMPLEMENT_COMPLETE_TEMPLATE = loadTemplate(
  import.meta.url,
  'templates',
  'pr-comment-implement-completed.md',
);
const CODE_REVIEW_COMPLETE_TEMPLATE = loadTemplate(
  import.meta.url,
  'templates',
  'pr-comment-code-review-completed.md',
);
const JOB_SUMMARY_STEP_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'job-summary-step.md');

const FIX_APPLIED_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'pr-comment-fix-applied.md');
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
      const delayMs = attempt * 3000;
      console.warn(
        `[dev-agent-teardown] PR comment failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s…`,
        err,
      );
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

async function markPullRequestReadyGraphql(
  token: string,
  pullRequestNodeId: string,
): Promise<{ ok: boolean; errors?: string }> {
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
    if (/already\s+ready|not\s+a\s+draft|cannot\s+mark.*ready/i.test(msg)) {
      return { ok: true };
    }
    return { ok: false, errors: msg };
  }
  return { ok: true };
}

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
/*  Speckit teardown                                                   */
/* ------------------------------------------------------------------ */

async function runSpeckitTeardown(): Promise<void> {
  const repository = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey = requireEnv('ISSUE_KEY');
  const step = parseSpeckitStep(requireEnv('STEP'));
  const branchName = requireEnv('BRANCH_NAME');
  const prNumberRaw = requireEnv('PR_NUMBER');
  const prNumber = parseInt(prNumberRaw, 10);
  if (!Number.isFinite(prNumber) || prNumber < 1) {
    throw new Error(`Invalid PR_NUMBER: ${JSON.stringify(prNumberRaw)}`);
  }
  let featureDir = process.env['FEATURE_DIR']?.trim() || '';

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

  if (!featureDir) {
    featureDir = `.specify/features/${issueKey}`;
  }

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
    featureDir,
  };
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  git(`add ${statePath}`);
  git(`commit -m "speckit(${step}): update speckit-state.json"`);
  const stateCommitSha = git('rev-parse HEAD');
  git(`push origin ${branchName}`);
  console.log(`[dev-agent-teardown] Pushed. nextStep=${state.nextStep ?? 'null (all done)'}`);

  if (step === 'implement' || step === 'code_review') {
    await markPullNonDraft(owner, repo, prNumber);
  }

  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repoUrl = `${serverUrl}/${owner}/${repo}`;

  const commitsMd = `- ${commitLink(stateCommitSha, repoUrl, `speckit(${step}): update speckit-state.json`)}`;

  appendSummary(
    fillTemplate(JOB_SUMMARY_STEP_TEMPLATE, {
      STEP: step,
      STEP_INDEX: String(STEP_ORDER.indexOf(step) + 1),
      STEP_TOTAL: String(STEP_ORDER.length),
      ISSUE_KEY: issueKey,
      FEATURE_DIR: featureDir,
      COMMITS_MD: commitsMd,
      PR_NUMBER: String(prNumber),
      PR_URL: `${repoUrl}/pull/${prNumber}`,
    }),
  );

  const next = state.nextStep;
  const runUrl = process.env['GITHUB_RUN_ID']
    ? `${serverUrl}/${owner}/${repo}/actions/runs/${process.env['GITHUB_RUN_ID']}`
    : '';
  const runLink = runUrl ? `\n\n<sub>Produced by [workflow run](${runUrl})</sub>` : '';

  const commentBody = next
    ? fillTemplate(STEP_COMPLETE_TEMPLATE, {
        STEP: step,
        STEP_LABEL: stepLabel(step),
        BRANCH_NAME: branchName,
        NEXT_STEP: next,
        RUN_LINK: runLink,
      })
    : step === 'code_review'
      ? fillTemplate(CODE_REVIEW_COMPLETE_TEMPLATE, {
          STEP_LABEL: stepLabel(step),
          RUN_LINK: runLink,
        })
      : fillTemplate(IMPLEMENT_COMPLETE_TEMPLATE, {
          STEP_LABEL: stepLabel(step),
          RUN_LINK: runLink,
        });

  await postComment(octokitComment, owner, repo, prNumber, commentBody);

  console.log(`[dev-agent-teardown] Step "${step}" complete.`);
}

/* ------------------------------------------------------------------ */
/*  Fix teardown                                                       */
/* ------------------------------------------------------------------ */

async function runFixTeardown(): Promise<void> {
  const repository = requireEnv('GITHUB_REPOSITORY');
  const issueKey = requireEnv('ISSUE_KEY');
  const prNumber = parseInt(requireEnv('PR_NUMBER'), 10);
  const branchName = requireEnv('BRANCH_NAME');
  const inputPrompt = process.env['INPUT_PROMPT'] || '';

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

  const statePath = findSpeckitStateFilePath(issueKey);
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
  state['lastFixedAt'] = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  git(`add ${statePath}`);
  git(`commit -m "speckit(fix): trigger spec gate re-validation for ${issueKey}"`);
  const stateCommitSha = git('rev-parse HEAD');

  git(`push origin ${branchName}`);
  console.log('[dev-agent-teardown] fix: pushed — spec gate will re-validate');

  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repoUrl = `${serverUrl}/${owner}/${repo}`;

  const commitsMd = `- ${commitLink(stateCommitSha, repoUrl, `speckit(fix): trigger spec gate re-validation for ${issueKey}`)}`;

  appendSummary(
    fillTemplate(JOB_SUMMARY_FIX_TEMPLATE, {
      ISSUE_KEY: issueKey,
      INPUT_PROMPT: inputPrompt,
      COMMITS_MD: commitsMd,
      PR_NUMBER: String(prNumber),
      PR_URL: `${repoUrl}/pull/${prNumber}`,
    }),
  );

  const runId = process.env['GITHUB_RUN_ID'];
  const runLink = runId
    ? `\n\n<sub>Produced by [workflow run](${repoUrl}/actions/runs/${runId})</sub>`
    : '';

  await postComment(
    octokitComment,
    owner,
    repo,
    prNumber,
    fillTemplate(FIX_APPLIED_TEMPLATE, {
      BRANCH_NAME: branchName,
      RUN_LINK: runLink,
    }),
  );

  console.log('[dev-agent-teardown] fix: complete.');
}

/* ------------------------------------------------------------------ */
/*  Entry                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const mode = getAgentMode();
  if (mode === 'fix') await runFixTeardown();
  else await runSpeckitTeardown();
}

main().catch(err => {
  console.error('[dev-agent-teardown] Fatal error:', err);
  process.exit(1);
});
