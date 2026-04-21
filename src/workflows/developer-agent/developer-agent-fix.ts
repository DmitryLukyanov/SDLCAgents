/**
 * Developer Agent — Fix entry point (legacy, SUPERSEDED).
 *
 * ⚠️  This file is no longer called by _reusable-developer-agent-fix.yml.
 *     The workflow uses prepare / dedicated Codex job / teardown:
 *       developer-agent-fix-setup.ts    → writes fix prompt file
 *       _reusable-codex-run.yml         → Codex reads artifacts, applies fixes
 *       developer-agent-fix-teardown.ts → stages, commits, pushes, comments
 *     Kept for reference only.
 *
 * Makes TARGETED edits to existing spec-kit artifacts to address specific
 * issues reported by the spec gate. Does NOT re-run the full speckit step.
 *
 * Flow:
 *   1. Read all existing artifacts from the feature directory
 *   2. Call LLM with fix instructions + current artifacts as context
 *   3. Write only the files returned by the LLM (or commit disk changes for Codex)
 *   4. Commit artifact changes
 *   5. Update speckit-state.json lastFixedAt → triggers spec gate re-validation
 *   6. Push + post PR comment
 *
 * Environment variables (set by _reusable-developer-agent-fix.yml):
 *   GITHUB_TOKEN or COPILOT_PAT  — GitHub API token
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   ISSUE_KEY                    — Jira issue key (e.g. "PROJ-1")
 *   PR_NUMBER                    — PR number (string)
 *   FIX_INSTRUCTIONS             — extracted fix instructions (after /fix prefix stripped)
 *   DEVELOPER_AGENT_MODEL        — Codex model override (default: o4-mini)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { createSpecProvider, parseFileBlocks } from './llm-provider.js';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

// PR comment templates
const FIX_APPLIED_TEMPLATE           = loadTemplate(import.meta.url, 'templates', 'pr-comment-fix-applied.md');

// Prompt templates
const FIX_SYSTEM_PROMPT_TMPL         = loadTemplate(import.meta.url, 'templates', 'prompt-fix-system.md');
const FILE_OUTPUT_INSTRUCTIONS_TMPL  = loadTemplate(import.meta.url, 'templates', 'prompt-file-output-instructions.md');

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
      console.warn(`[dev-agent-fix] PR comment failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s…`, err);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/** Recursively collect all .md files under dir, excluding speckit-state.json. */
function readArtifacts(dir: string, base = dir): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel  = full.slice(base.length + 1).replace(/\\/g, '/');
    if (statSync(full).isDirectory()) {
      for (const [k, v] of readArtifacts(full, base)) result.set(k, v);
    } else if (entry.endsWith('.md')) {
      result.set(rel, readFileSync(full, 'utf8'));
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const token          = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository     = requireEnv('GITHUB_REPOSITORY');
  const issueKey       = requireEnv('ISSUE_KEY');
  const prNumber       = parseInt(requireEnv('PR_NUMBER'), 10);
  const fixInstructions = requireEnv('FIX_INSTRUCTIONS');

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit    = new Octokit({ auth: token });
  const featureDir = `.specify/features/${issueKey}`;

  // ── 1. Read existing artifacts ───────────────────────────────────
  const artifacts = readArtifacts(featureDir);
  if (artifacts.size === 0) throw new Error(`No artifacts found in ${featureDir}`);

  const artifactsSection = [...artifacts.entries()]
    .map(([path, content]) => `### ${path}\n\n${content}`)
    .join('\n\n---\n\n');

  console.log(`[dev-agent-fix] Loaded ${artifacts.size} artifact(s): ${[...artifacts.keys()].join(', ')}`);

  // ── 2. Build prompt ──────────────────────────────────────────────
  const provider = createSpecProvider();

  const systemPrompt = [FIX_SYSTEM_PROMPT_TMPL, '', FILE_OUTPUT_INSTRUCTIONS_TMPL].join('\n');

  const userMessage = [
    '## Issues to Fix',
    '',
    fixInstructions,
    '',
    '## Current Artifacts',
    '',
    artifactsSection,
    '',
    '## Instruction',
    '',
    'Output ONLY the files that require changes. Omit files that are already correct.',
  ].join('\n');

  // ── 3. Call LLM ──────────────────────────────────────────────────
  console.log(`[dev-agent-fix] Calling LLM (prompt ~${systemPrompt.length + userMessage.length} chars)...`);
  const response = await provider.complete(systemPrompt, userMessage);
  console.log(`[dev-agent-fix] LLM response: ${response.length} chars`);

  // ── 4. Write changed files ────────────────────────────────────────
  const files = parseFileBlocks(response);
  if (files.size === 0) {
    // LLM returned no <file> blocks — log a warning and commit whatever changed on disk.
    console.warn('[dev-agent-fix] No <file> blocks in LLM response — committing disk changes');
  }
  for (const [relPath, content] of files) {
    const fullPath = join(featureDir, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content + '\n');
    console.log(`[dev-agent-fix] Wrote ${relPath} (${content.length} chars)`);
  }

  // ── 5. Commit artifact changes ────────────────────────────────────
  // Use `git diff --cached` after staging featureDir so untracked directories
  // (e.g. .sdlc-agents/) don't cause a false-positive hasChanges check.
  git(`add ${featureDir}`);
  const stagedFiles = git(`diff --cached --name-only`);
  const hasArtifactChanges = stagedFiles.length > 0;
  let artifactCommitSha = '';
  if (hasArtifactChanges) {
    console.log(`[dev-agent-fix] Staged changes:\n${stagedFiles}`);
    git(`commit -m "speckit(fix): apply targeted fixes for ${issueKey}"`);
    artifactCommitSha = git('rev-parse HEAD');
  } else {
    console.warn('[dev-agent-fix] No artifact changes to commit (LLM made no edits)');
  }

  // ── 6. Touch speckit-state.json → triggers spec gate re-validation ─
  const statePath = join(featureDir, 'speckit-state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
  state['lastFixedAt'] = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  git(`add ${statePath}`);
  git(`commit -m "speckit(fix): trigger spec gate re-validation for ${issueKey}"`);
  const stateCommitSha = git('rev-parse HEAD');

  // ── 7. Push ───────────────────────────────────────────────────────
  const branchName = state['branchName'] as string | undefined;
  if (!branchName) throw new Error('speckit-state.json is missing branchName — cannot push');
  git(`push origin ${branchName}`);
  console.log('[dev-agent-fix] Pushed — spec gate will re-validate');

  // ── 8. Write GitHub Actions job summary ──────────────────────────
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
    : '_No artifact changes detected (LLM made no edits)_';

  const commits: string[] = [];
  if (artifactCommitSha) commits.push(commitLink(artifactCommitSha, repoUrl, `speckit(fix): apply targeted fixes for ${issueKey}`));
  commits.push(commitLink(stateCommitSha, repoUrl, `speckit(fix): trigger spec gate re-validation for ${issueKey}`));

  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

  appendSummary([
    `# Spec-Kit · Fix — ${issueKey}`,
    '',
    '## Fix Instructions',
    '',
    fixInstructions,
    '',
    '## LLM',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Provider | \`${provider.description}\` |`,
    `| Combined prompt | ${combinedPrompt.length} chars |`,
    '',
    `<details><summary>Full prompt sent to LLM · ${combinedPrompt.length} chars</summary>`,
    '',
    '```',
    combinedPrompt,
    '```',
    '',
    '</details>',
    '',
    '## Files Changed',
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

  // ── 9. Post PR comment ────────────────────────────────────────────
  const runId   = process.env['GITHUB_RUN_ID'];
  const runLink = runId
    ? `\n\n<sub>Produced by [workflow run](${repoUrl}/actions/runs/${runId})</sub>`
    : '';

  await postComment(octokit, owner, repo, prNumber, fillTemplate(FIX_APPLIED_TEMPLATE, {
    BRANCH_NAME: branchName,
    RUN_LINK:    runLink,
  }));

  console.log('[dev-agent-fix] Fix complete.');
}

main().catch((err) => {
  console.error('[dev-agent-fix] Fatal error:', err);
  process.exit(1);
});
