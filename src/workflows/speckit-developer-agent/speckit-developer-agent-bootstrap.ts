/**
 * SpecKit Developer Agent — Bootstrap (runs before speckit-developer-agent for specify).
 *
 * Ensures a remote feature branch, draft PR linked to the GitHub issue, and an
 * initial `speckit-state.json` under `.specify/features/{ISSUE_KEY}/` exist and
 * are pushed. The speckit-developer-agent workflow then only consumes BRANCH_NAME,
 * PR_NUMBER, and ISSUE_* (no branch/PR/state creation in setup for that path).
 *
 * Environment:
 *   GITHUB_REPOSITORY, ISSUE_NUMBER, ISSUE_KEY
 *   COPILOT_PAT or GITHUB_TOKEN
 *   BRANCH_NAME — optional; empty = reuse open draft PR for the issue if any,
 *                 else create `feature/{slug}-{timestamp}` on the default branch
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Octokit } from '@octokit/rest';

type SpeckitStep =
  | 'specify'
  | 'clarify'
  | 'plan'
  | 'tasks'
  | 'implement'
  | 'code_review';

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
  console.log(`[dev-agent-bootstrap] output: ${name}=${value}`);
}

const featureSlug = (issueKey: string): string =>
  issueKey.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^-+|-+$/g, '') || 'issue';

async function findExistingSpecifyBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  githubIssueNumber: number,
  issueKey: string,
): Promise<string | null> {
  const marker = `Resolves #${githubIssueNumber}`;
  const slug = featureSlug(issueKey);
  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'updated',
    direction: 'desc',
    per_page: 50,
  });
  const candidates = pulls.filter(
    p =>
      (p.body?.includes(marker) ?? false) &&
      p.head.ref.startsWith(`feature/${slug}-`) &&
      p.head.repo.full_name?.toLowerCase() === `${owner}/${repo}`.toLowerCase(),
  );
  if (candidates.length === 0) return null;
  const pick = candidates.find(p => p.draft === true) ?? candidates[0];
  console.log(
    `[dev-agent-bootstrap] Reusing existing PR #${pick.number} branch \`${pick.head.ref}\`.`,
  );
  return pick.head.ref;
}

async function createRemoteFeatureBranch(
  owner: string,
  repo: string,
  issueKey: string,
  octokit: Octokit,
): Promise<string> {
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;
  const { data: baseCommit } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: baseSha });
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `chore(${issueKey}): init feature branch`,
    tree: baseCommit.tree.sha,
    parents: [baseSha],
  });
  const slug = featureSlug(issueKey);
  const branchName = `feature/${slug}-${Date.now()}`;
  const fullRef = `refs/heads/${branchName}`;
  try {
    await octokit.rest.git.createRef({ owner, repo, ref: fullRef, sha: newCommit.sha });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 422) {
      throw new Error(
        `Could not create ${fullRef} (already exists or invalid). Remove the branch or retry.`,
      );
    }
    throw err;
  }
  console.log(
    `[dev-agent-bootstrap] Created remote branch ${branchName} from ${defaultBranch} (${newCommit.sha.slice(0, 7)})`,
  );
  return branchName;
}

async function main(): Promise<void> {
  const token = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const issueNumber = parseInt(requireEnv('ISSUE_NUMBER'), 10);
  const issueKey = requireEnv('ISSUE_KEY');
  const desiredBranch = (process.env['BRANCH_NAME'] ?? '').trim();

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit = new Octokit({ auth: token });
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  let branchName: string;
  if (desiredBranch) {
    branchName = desiredBranch;
    console.log(`[dev-agent-bootstrap] Using requested branch ${branchName}`);
  } else {
    const existing = await findExistingSpecifyBranch(octokit, owner, repo, issueNumber, issueKey);
    branchName = existing ?? (await createRemoteFeatureBranch(owner, repo, issueKey, octokit));
  }

  git('fetch origin');
  const remoteRef = git(`ls-remote --heads origin ${branchName}`);
  if (!remoteRef) {
    git(`checkout -b ${branchName}`);
    git(`commit --allow-empty -m "chore(${issueKey}): init feature branch"`);
    git(`push -u origin ${branchName}`);
  } else {
    git(`fetch origin ${branchName}`);
    git(`checkout -B ${branchName} origin/${branchName}`);
  }

  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  let prNumber: number;
  if (prs.length > 0) {
    prNumber = prs[0].number;
    console.log(`[dev-agent-bootstrap] Using open PR #${prNumber}`);
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
    await octokit.rest.issues
      .addLabels({ owner, repo, issue_number: prNumber, labels: [`jira:${issueKey}`] })
      .catch(() => {
        /* label may not exist yet */
      });
    console.log(`[dev-agent-bootstrap] Created draft PR #${prNumber}`);
  }

  const featureDir = `.specify/features/${issueKey}`;
  const statePath = join(featureDir, 'speckit-state.json');
  const now = new Date().toISOString();

  let state: SpeckitState;
  if (existsSync(statePath)) {
    const prev = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
    state = {
      ...prev,
      issueNumber,
      issueKey,
      prNumber,
      branchName,
      featureDir,
      lastUpdated: now,
    };
  } else {
    state = {
      completedSteps: [],
      nextStep: 'specify',
      lastUpdated: now,
      issueNumber,
      issueKey,
      prNumber,
      branchName,
      featureDir,
    };
  }

  mkdirSync(featureDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  const dirty = git('status --porcelain');
  if (dirty) {
    git(`add ${statePath}`);
    git(`commit -m "chore(${issueKey}): bootstrap speckit-state.json"`);
    git(`push origin ${branchName}`);
    console.log(`[dev-agent-bootstrap] Pushed speckit-state.json`);
  } else {
    console.log(`[dev-agent-bootstrap] speckit-state.json already up to date on branch`);
  }

  setOutput('branch_name', branchName);
  setOutput('pr_number', String(prNumber));
  setOutput('feature_dir', featureDir);
}

main().catch(err => {
  console.error('[dev-agent-bootstrap] Fatal error:', err);
  process.exit(1);
});
