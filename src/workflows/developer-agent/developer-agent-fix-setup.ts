/**
 * Developer Agent — Fix Setup phase.
 *
 * Runs BEFORE the dedicated Codex job (`_reusable-codex-run.yml`) in the fix workflow.
 *
 * Responsibilities:
 *  1. Read featureDir + issueNumber from speckit-state.json
 *  2. Fetch the linked GitHub issue (title + body) for general context
 *  3. Determine Codex model
 *  4. Write a targeted-fix prompt to .sdlc-agents/codex-fix-prompt.md
 *  5. Write to GITHUB_OUTPUT: feature_dir, codex_model
 *
 * Environment variables (set by _reusable-developer-agent-fix.yml):
 *   GITHUB_TOKEN or COPILOT_PAT — GitHub API token
 *   GITHUB_REPOSITORY           — "owner/repo"
 *   ISSUE_KEY                   — Jira issue key (read from speckit-state.json by the workflow)
 *   FIX_INSTRUCTIONS            — extracted fix instructions (after /fix prefix stripped)
 *   DEVELOPER_AGENT_MODEL       — model override (default: o4-mini)
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Octokit } from '@octokit/rest';

import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SpeckitState {
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
  console.log(`[dev-agent-fix-setup] output: ${name}=${value}`);
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
  const token        = process.env['COPILOT_PAT'] ?? process.env['GITHUB_TOKEN'] ?? '';
  const repository   = process.env['GITHUB_REPOSITORY'] ?? '';
  const issueKey     = requireEnv('ISSUE_KEY');
  const fixInstructions = requireEnv('FIX_INSTRUCTIONS');
  const codexModel   = process.env['DEVELOPER_AGENT_MODEL']?.trim() || 'o4-mini';

  // ── 1. Read featureDir + issueNumber from speckit-state.json ────
  const statePath = findStateFilePath(issueKey);
  if (!existsSync(statePath)) {
    throw new Error(`speckit-state.json not found for ${issueKey} (searched legacy path + find)`);
  }
  const state      = JSON.parse(readFileSync(statePath, 'utf8')) as SpeckitState;
  const featureDir = state.featureDir ?? dirname(statePath);

  console.log(`[dev-agent-fix-setup] featureDir=${featureDir} model=${codexModel}`);

  // ── 2. Fetch linked GitHub issue for context ─────────────────────
  let issueContext = '';
  const issueNumber = state.issueNumber;
  if (issueNumber && token && repository) {
    try {
      const [owner, repo] = repository.split('/');
      const octokit = new Octokit({ auth: token });
      const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
      // Strip the embedded pipeline config block — keep only the human-readable description
      const cleanBody = (issue.body ?? '')
        .replace(/<!--sdlc-pipeline-config[\s\S]*?\/sdlc-pipeline-config-->/g, '')
        .trim();
      issueContext = [
        `## Feature Context`,
        ``,
        `**Issue #${issueNumber}**: ${issue.title}`,
        ...(cleanBody ? [``, cleanBody] : []),
      ].join('\n');
      console.log(`[dev-agent-fix-setup] Fetched issue #${issueNumber}: "${issue.title}"`);
    } catch (err) {
      console.warn('[dev-agent-fix-setup] Could not fetch issue (non-fatal):', err);
    }
  }

  // ── 3. Write fix prompt ──────────────────────────────────────────
  // The fixInstructions string contains:
  //   - the user's /fix comment text (before the ---)
  //   - optionally a "## Spec Gate Issues to Address" block (appended by pr-comment-handler)
  // Split them so we can place spec gate issues prominently.
  const separatorIdx = fixInstructions.indexOf('\n\n---\n\n## Spec Gate Issues to Address');
  const userInstruction  = separatorIdx >= 0
    ? fixInstructions.slice(0, separatorIdx).trim()
    : fixInstructions.trim();
  const specGateContext  = separatorIdx >= 0
    ? fixInstructions.slice(separatorIdx + '\n\n---\n\n'.length).trim()
    : '';

  const issueSection = issueContext ? `${issueContext}\n\n` : '';
  const specGateSection = specGateContext ? `${specGateContext}\n\n` : '';
  const reviewerSection = userInstruction
    ? `## Reviewer Instructions\n\n${userInstruction}\n\n`
    : '';

  const tmpl = loadTemplate(import.meta.url, 'prompts', 'codex-fix-user-prompt.md');
  const prompt = fillTemplate(tmpl, {
    FEATURE_DIR: featureDir,
    ISSUE_CONTEXT: issueSection,
    SPEC_GATE_SECTION: specGateSection,
    REVIEWER_SECTION: reviewerSection,
  });

  mkdirSync('.sdlc-agents', { recursive: true });
  writeFileSync('.sdlc-agents/codex-fix-prompt.md', prompt + '\n');
  console.log(`[dev-agent-fix-setup] Wrote fix prompt to .sdlc-agents/codex-fix-prompt.md (${prompt.length} chars)`);

  // ── 3. Write GitHub step outputs ─────────────────────────────────
  setOutput('feature_dir', featureDir);
  setOutput('codex_model', codexModel);

  console.log('[dev-agent-fix-setup] Setup complete');
}

main().catch((err) => {
  console.error('[dev-agent-fix-setup] Fatal error:', err);
  process.exit(1);
});
