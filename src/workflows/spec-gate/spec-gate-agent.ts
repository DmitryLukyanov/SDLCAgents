/**
 * Spec Gate — entry point.
 *
 * CI (via _reusable-spec-gate.yml):
 *   SPEC_GATE_MODE=codex_prepare — load artifacts, write `spec-gate-codex-artifacts/spec-gate-codex-prompt.md`
 *   (separate workflow job runs `openai/codex-action@v1`, then codex_finish)
 *   SPEC_GATE_MODE=codex_finish — read `spec-gate-codex-artifacts/spec-gate-codex-output.txt`, dispatch / comment
 *
 * Environment variables (set by _reusable-spec-gate.yml):
 *   COPILOT_PAT                  — workflow_dispatch (Bearer)
 *   GITHUB_TOKEN                 — ${{ github.token }} for issues.createComment
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   SPECKIT_STEP                 — step that just completed (e.g. "clarify")
 *   FEATURE_DIR                  — path to the feature directory
 *   PR_NUMBER                    — open PR number for this branch
 *   DEFAULT_BRANCH               — (optional) ref for workflow dispatch; default master
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Octokit } from '@octokit/rest';
import { buildSpecGateCodexPromptDocument, interpretGateCodexOutput } from './analyze-spec.js';
import { STEP_FILES, STEP_ORDER, type GateAnalysisResult, type SpeckitStep } from './spec-gate-types.js';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

const PROCEED_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'pr-comment-proceed.md');
const HIL_TEMPLATE     = loadTemplate(import.meta.url, 'templates', 'pr-comment-hil.md');

const PROCEED_WORKFLOW_ID = 'speckit-developer-agent-proceed.yml';

/** Repo-root folder (small) passed between jobs via artifacts — not under `.sdlc-agents/node_modules`. */
const CODEX_ARTIFACT_DIR = 'spec-gate-codex-artifacts';
const CODEX_PROMPT_REL  = join(CODEX_ARTIFACT_DIR, 'spec-gate-codex-prompt.md');
const CODEX_OUTPUT_REL  = join(CODEX_ARTIFACT_DIR, 'spec-gate-codex-output.txt');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function appendStepSummary(md: string): void {
  const f = process.env['GITHUB_STEP_SUMMARY'];
  if (f) appendFileSync(f, `${md}\n`);
}

function escCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 500);
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

function stepLabel(step: SpeckitStep): string {
  const idx = STEP_ORDER.indexOf(step);
  return `${step} (${idx + 1}/${STEP_ORDER.length})`;
}

function buildProceedComment(step: SpeckitStep, summary: string): string {
  const summaryBlock = summary ? `\n_${summary}_` : '';
  return fillTemplate(PROCEED_TEMPLATE, {
    STEP_LABEL: stepLabel(step),
    SUMMARY_BLOCK: summaryBlock,
  }).trim();
}

function buildHilComment(
  step: SpeckitStep,
  summary: string,
  issues: Array<{ file: string; line: number; text: string }>,
): string {
  const isImplement   = step === 'implement';
  const isCodeReview  = step === 'code_review';

  const hilMarker = isCodeReview
    ? 'speckit-gate: hil-code-review'
    : isImplement
      ? 'speckit-gate: hil-implement'
      : 'speckit-gate: hil';
  const hilHeading = isCodeReview
    ? 'Spec Gate: Code Review Complete — Human Merge Required ✅'
    : isImplement
      ? (issues.length > 0
          ? 'Spec Gate: Implementation — Fix Before Code Review ⚠️'
          : 'Spec Gate: Implementation — Manual Check Required ⚠️')
      : 'Spec Gate: Human Review Required ⚠️';
  const hilIntro = isCodeReview
    ? 'The automated **code_review** step has finished. Review `code-review-summary.md` and `.code-review-verdict`, then merge or request changes.'
    : isImplement
      ? (issues.length > 0
          ? `Resolve the **${issues.length} issue(s)** below so the pipeline can run the automated **code_review** step.`
          : 'The gate did not auto-advance after implementation. Review the summary, then when ready add a new PR comment whose body is exactly `/proceed` (one line, nothing else).')
      : `The automated spec gate found **${issues.length} issue(s)** in the \`${stepLabel(step)}\` artifacts that need resolution before proceeding.`;

  let issuesSection = '';
  if (issues.length > 0) {
    const tableRows = issues.map((issue) => {
      const lineRef = issue.line > 0 ? String(issue.line) : '—';
      const safeText = issue.text.replace(/\|/g, '\\|');
      return `| \`${issue.file}\` | ${lineRef} | ${safeText} |`;
    });
    issuesSection = [
      '',
      '### Issues Found',
      '',
      '| File | Line | Issue |',
      '|------|------|-------|',
      ...tableRows,
    ].join('\n');
  }

  const hilFooter = isCodeReview
    ? '\n---\n_Address review findings or merge when ready._'
    : isImplement
      ? '\n---\nFix the issues above. When ready, add a **new PR comment** whose body is exactly this one line:\n\n/proceed\n\nThis continues the pipeline (next: automated **code_review**).'
      : '\n---\nWhen you have addressed the findings above, add a **new PR comment** whose body is exactly this one line:\n\n/proceed\n\nThis continues the pipeline.';

  return fillTemplate(HIL_TEMPLATE, {
    HIL_MARKER: hilMarker,
    HIL_HEADING: hilHeading,
    HIL_INTRO: hilIntro,
    SUMMARY: summary,
    ISSUES_SECTION: issuesSection,
    HIL_FOOTER: hilFooter,
  }).trim();
}

interface GatePostContext {
  owner: string;
  repo: string;
  step: SpeckitStep;
  prNumber: number;
  modelsToken: string;
  featureDir: string;
  files: Map<string, string>;
}

async function postGateResults(result: GateAnalysisResult, ctx: GatePostContext): Promise<void> {
  const { owner, repo, step, prNumber, modelsToken, featureDir, files } = ctx;

  let dispatchedProceed = false;

  if (result.proceed) {
    const defaultBranch = process.env['DEFAULT_BRANCH'] || 'master';
    const octokitPat = new Octokit({ auth: modelsToken });
    console.log(
      `[gate] Dispatching ${PROCEED_WORKFLOW_ID} ref=${defaultBranch} pr=${prNumber}`,
    );
    await octokitPat.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: PROCEED_WORKFLOW_ID,
      ref: defaultBranch,
      inputs: { pr_number: String(prNumber) },
    });
    console.log('[gate] speckit-developer-agent-proceed workflow_dispatch succeeded');
    dispatchedProceed = true;
  }

  const serverUrl = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const runId     = process.env['GITHUB_RUN_ID'];
  const runLink   = runId
    ? `\n\n<sub>Produced by [workflow run](${serverUrl}/${owner}/${repo}/actions/runs/${runId})</sub>`
    : '';

  const comment = (result.proceed
    ? buildProceedComment(step, result.summary)
    : buildHilComment(step, result.summary, result.issues)) + runLink;

  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });
  await octokitComment.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: comment,
  });

  console.log(`[gate] Posted ${result.proceed ? 'PROCEED' : 'HIL'} comment on PR #${prNumber}`);

  const artifactList = [...files.keys()].join(', ') || '_(none loaded)_';
  const refName = process.env['GITHUB_REF_NAME'] ?? '—';
  const sha = process.env['GITHUB_SHA'] ?? '—';
  const shaShort = sha.length > 7 ? sha.slice(0, 7) : sha;
  const eventName = process.env['GITHUB_EVENT_NAME'] ?? '—';
  const modelShown = '_(repo variable GATE_CODEX_MODEL, required - no default)_';

  appendStepSummary('## Spec gate');
  appendStepSummary('');
  appendStepSummary('### Inputs');
  appendStepSummary('');
  appendStepSummary('| Input | Value |');
  appendStepSummary('|-------|-------|');
  appendStepSummary(`| \`GITHUB_REPOSITORY\` | \`${escCell(`${owner}/${repo}`)}\` |`);
  appendStepSummary(`| \`SPECKIT_STEP\` | \`${escCell(step)}\` (${escCell(stepLabel(step))}) |`);
  appendStepSummary(`| \`FEATURE_DIR\` | \`${escCell(featureDir)}\` |`);
  appendStepSummary(`| \`PR_NUMBER\` | ${prNumber} |`);
  appendStepSummary(`| \`DEFAULT_BRANCH\` | \`${escCell(process.env['DEFAULT_BRANCH'] || 'master')}\` |`);
  appendStepSummary(`| **Codex model** | ${escCell(modelShown)} |`);
  appendStepSummary(`| Push / context | \`${escCell(refName)}\` @ \`${escCell(shaShort)}\` (\`${escCell(eventName)}\`) |`);
  appendStepSummary(`| **Artifacts read** | ${escCell(artifactList)} |`);
  appendStepSummary('');
  appendStepSummary('### Outputs');
  appendStepSummary('');
  appendStepSummary('| Output | Value |');
  appendStepSummary('|--------|-------|');
  appendStepSummary(
    `| **Pull request** | [PR #${prNumber}](${serverUrl}/${owner}/${repo}/pull/${prNumber}) |`,
  );
  appendStepSummary(`| **proceed** (auto-advance) | \`${result.proceed}\` |`);
  appendStepSummary(`| **issues** (count) | ${result.issues.length} |`);
  appendStepSummary(
    `| **workflow_dispatch** | ${dispatchedProceed ? `\`${PROCEED_WORKFLOW_ID}\` on default branch` : '_skipped (HIL or not applicable)_'} |`,
  );
  appendStepSummary(`| **PR comment** | ${result.proceed ? '**PROCEED** (validation passed + next step triggered)' : '**HIL** (human or `/proceed` required)'} |`);
  appendStepSummary('');
  appendStepSummary('#### LLM summary');
  appendStepSummary('');
  appendStepSummary(result.summary.trim() ? escCell(result.summary) : '_(empty)_');
  if (result.issues.length > 0) {
    appendStepSummary('');
    appendStepSummary('#### Issues (first rows)');
    appendStepSummary('');
    appendStepSummary('| File | Line | Text |');
    appendStepSummary('|------|------|------|');
    for (const issue of result.issues.slice(0, 20)) {
      appendStepSummary(
        `| \`${escCell(issue.file)}\` | ${issue.line} | ${escCell(issue.text)} |`,
      );
    }
    if (result.issues.length > 20) {
      appendStepSummary('');
      appendStepSummary(`_… and ${result.issues.length - 20} more (see PR comment)._`);
    }
  }
}

function resolveGateContext(): GatePostContext {
  const modelsToken = requireEnv('COPILOT_PAT');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const step = requireEnv('SPECKIT_STEP') as SpeckitStep;
  const featureDir = requireEnv('FEATURE_DIR');
  const prNumber = parseInt(requireEnv('PR_NUMBER'), 10);

  if (!STEP_ORDER.includes(step)) {
    throw new Error(`Unknown step: "${step}". Valid steps: ${STEP_ORDER.join(', ')}`);
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY format: "${repository}"`);
  }

  const files = loadFiles(featureDir, step);

  return { owner, repo, step, prNumber, modelsToken, featureDir, files };
}

async function runCodexPrepare(): Promise<void> {
  const ctx = resolveGateContext();
  console.log(`[gate] codex_prepare step=${ctx.step} featureDir=${ctx.featureDir} pr=${ctx.prNumber}`);

  const doc = buildSpecGateCodexPromptDocument(ctx.step, ctx.files);
  const abs = join(process.cwd(), CODEX_PROMPT_REL);
  mkdirSync(join(process.cwd(), CODEX_ARTIFACT_DIR), { recursive: true });
  writeFileSync(abs, doc, 'utf8');
  console.log(`[gate] Wrote ${CODEX_PROMPT_REL} (${doc.length} chars)`);
}

async function runCodexFinish(): Promise<void> {
  const ctx = resolveGateContext();
  console.log(`[gate] codex_finish step=${ctx.step} featureDir=${ctx.featureDir} pr=${ctx.prNumber}`);

  const outAbs = join(process.cwd(), CODEX_OUTPUT_REL);
  let raw = '';
  try {
    raw = readFileSync(outAbs, 'utf8');
  } catch {
    console.warn(`[gate] Missing Codex output file: ${CODEX_OUTPUT_REL}`);
  }

  const result = interpretGateCodexOutput(raw, ctx.step);
  await postGateResults(result, ctx);
}

async function main(): Promise<void> {
  const mode = process.env['SPEC_GATE_MODE']?.trim() ?? '';
  if (mode === 'codex_prepare') {
    await runCodexPrepare();
    return;
  }
  if (mode === 'codex_finish') {
    await runCodexFinish();
    return;
  }
  throw new Error(
    `SPEC_GATE_MODE must be "codex_prepare" or "codex_finish" (got "${mode || '(empty)'}").`,
  );
}

main().catch((err) => {
  console.error('[gate] Fatal error:', err);
  process.exit(1);
});
