/**
 * Spec Gate — entry point.
 *
 * Reads spec-kit artifacts for the completed pipeline step, calls the LLM
 * gate analyser, then posts a PR comment: either "@copilot proceed" (clean)
 * or "HIL required" (issues found / implement step).
 *
 * Environment variables (all set by _reusable-spec-gate.yml):
 *   GITHUB_TOKEN or COPILOT_PAT  — GitHub token (LLM API + REST API)
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   SPECKIT_STEP                 — step that just completed (e.g. "clarify")
 *   FEATURE_DIR                  — path to the feature directory (e.g. ".specify/features/my-feature")
 *   PR_NUMBER                    — open PR number for this branch
 *   GATE_MODEL                   — (optional) override LLM model
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { analyzeSpec } from './analyze-spec.js';
import { STEP_FILES, STEP_ORDER, type SpeckitStep } from './spec-gate-types.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function loadFiles(featureDir: string, step: SpeckitStep): Map<string, string> {
  const files = new Map<string, string>();
  const defs = STEP_FILES[step];

  for (const def of defs) {
    const fullPath = join(featureDir, def.path);
    if (!existsSync(fullPath)) {
      if (def.optional) {
        console.log(`[gate] Optional file not found, skipping: ${def.path}`);
      } else {
        console.warn(`[gate] Required file not found: ${fullPath}`);
      }
      continue;
    }
    const content = readFileSync(fullPath, 'utf8');
    files.set(def.path, content);
    console.log(`[gate] Loaded ${def.path} (${content.length} chars)`);
  }

  return files;
}

/* ------------------------------------------------------------------ */
/*  PR comment builders                                                */
/* ------------------------------------------------------------------ */

function stepLabel(step: SpeckitStep): string {
  const idx = STEP_ORDER.indexOf(step);
  return `${step} (${idx + 1}/${STEP_ORDER.length})`;
}

function buildProceedComment(step: SpeckitStep, summary: string): string {
  return [
    `<!-- speckit-gate: proceed -->`,
    `@copilot proceed`,
    ``,
    `---`,
    `_Spec gate passed ✅ — no open issues detected in the \`${stepLabel(step)}\` artifacts._`,
    summary ? `\n_${summary}_` : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n')
    .trim();
}

function buildHilComment(
  step: SpeckitStep,
  summary: string,
  issues: Array<{ file: string; line: number; text: string }>,
): string {
  const isImplement = step === 'implement';
  const marker = isImplement ? 'speckit-gate: hil-implement' : 'speckit-gate: hil';

  const lines: string[] = [
    `<!-- ${marker} -->`,
  ];

  if (isImplement) {
    lines.push(`## Spec Gate: Implementation Complete — Human Review Required ✅`);
    lines.push(``);
    lines.push(`The \`implement\` step has completed. This step always requires human review before merging.`);
  } else {
    lines.push(`## Spec Gate: Human Review Required ⚠️`);
    lines.push(``);
    lines.push(
      `The automated spec gate found **${issues.length} issue(s)** in the \`${stepLabel(step)}\` artifacts that need resolution before proceeding.`,
    );
  }

  lines.push(``);
  lines.push(summary);

  if (issues.length > 0) {
    lines.push(``);
    lines.push(`### Issues Found`);
    lines.push(``);
    lines.push(`| File | Line | Issue |`);
    lines.push(`|------|------|-------|`);
    for (const issue of issues) {
      const lineRef = issue.line > 0 ? String(issue.line) : '—';
      // Escape pipe characters in text to avoid breaking the table
      const safeText = issue.text.replace(/\|/g, '\\|');
      lines.push(`| \`${issue.file}\` | ${lineRef} | ${safeText} |`);
    }
  }

  if (!isImplement) {
    lines.push(``);
    lines.push(`---`);
    lines.push(`_Fix the issues above, then reply \`@copilot proceed\` to continue._`);
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const token = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const step = requireEnv('SPECKIT_STEP') as SpeckitStep;
  const featureDir = requireEnv('FEATURE_DIR');
  const prNumber = parseInt(requireEnv('PR_NUMBER'), 10);
  const model = process.env['GATE_MODEL'];

  if (!STEP_ORDER.includes(step)) {
    console.error(`[gate] Unknown step: "${step}". Valid steps: ${STEP_ORDER.join(', ')}`);
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY format: "${repository}"`);
  }

  console.log(`[gate] step=${step} featureDir=${featureDir} pr=${prNumber}`);

  // Load spec files
  const files = loadFiles(featureDir, step);

  // Run LLM analysis
  const result = await analyzeSpec(step, files, token, model);

  // Build comment
  const comment = result.proceed
    ? buildProceedComment(step, result.summary)
    : buildHilComment(step, result.summary, result.issues);

  // Post to PR
  const octokit = new Octokit({ auth: token });
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: comment,
  });

  console.log(`[gate] Posted ${result.proceed ? 'PROCEED' : 'HIL'} comment on PR #${prNumber}`);
}

main().catch((err) => {
  console.error('[gate] Fatal error:', err);
  process.exit(1);
});
