/**
 * Spec Gate — artifact analysis helpers for Codex.
 *
 * Prompts are built here and executed by `openai/codex-action@v1` (see _reusable-spec-gate.yml).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GateAnalysisResult, SpeckitStep } from './spec-gate-types.js';

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */

const GATE_SYSTEM_PROMPT = readFileSync(
  join(fileURLToPath(import.meta.url), '..', 'prompts', 'spec-gate-system-prompt.md'),
  'utf8',
).trim();

export function getGateSystemPrompt(): string {
  return GATE_SYSTEM_PROMPT;
}

const MAX_PROMPT_CHARS = 28_000;

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

/** User message: step + `<file>` blocks (used in the Codex prompt document). */
export function buildGateArtifactsPrompt(step: SpeckitStep, files: Map<string, string>): string {
  const parts: string[] = [`Step: ${step}\n`];

  let totalChars = parts[0].length;

  for (const [relPath, content] of files) {
    const truncateAt = MAX_PROMPT_CHARS - totalChars - relPath.length - 30;
    const body =
      content.length > truncateAt
        ? content.slice(0, truncateAt) + '\n\n[TRUNCATED — file exceeds context limit]'
        : content;

    const block = `<file name="${relPath}">\n${body}\n</file>`;
    parts.push(block);
    totalChars += block.length;

    if (totalChars >= MAX_PROMPT_CHARS) {
      console.warn(`[gate] Prompt truncated at file "${relPath}" (${totalChars} chars total)`);
      break;
    }
  }

  return parts.join('\n\n');
}

/**
 * Single markdown file for `openai/codex-action` (system rules + artifact payload + JSON reminder).
 */
export function buildSpecGateCodexPromptDocument(step: SpeckitStep, files: Map<string, string>): string {
  const artifacts = buildGateArtifactsPrompt(step, files);
  return [
    GATE_SYSTEM_PROMPT,
    '',
    '---',
    '',
    '## Artifacts to analyze',
    '',
    artifacts,
    '',
    '---',
    '',
    'Respond with ONLY a single JSON object (no markdown code fences) matching the schema described above: ' +
      '`proceed` (boolean), `issues` (array of { file, line, text }), `summary` (string).',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/*  Response parsing                                                   */
/* ------------------------------------------------------------------ */

export function tryParseGateResponse(raw: string, step: SpeckitStep): GateAnalysisResult | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    const result: GateAnalysisResult = {
      proceed: Boolean(parsed.proceed),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };

    if (step === 'code_review') {
      result.proceed = false;
      if (!result.summary.toLowerCase().includes('merge')) {
        result.summary = `Code review complete — human approval required before merging. ${result.summary}`.trim();
      }
    }

    return result;
  } catch {
    return null;
  }
}

function buildRunUrl(): string {
  const server = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  const repo   = process.env['GITHUB_REPOSITORY'];
  const runId  = process.env['GITHUB_RUN_ID'];
  return repo && runId ? `${server}/${repo}/actions/runs/${runId}` : '';
}

/** Parse Codex JSON output; on failure returns a safe HIL result. */
export function interpretGateCodexOutput(raw: string, step: SpeckitStep): GateAnalysisResult {
  console.log(`[gate] LLM raw response (first 300 chars): ${raw.slice(0, 300)}`);

  let result = tryParseGateResponse(raw, step);
  if (!result) {
    console.warn('[gate] First parse failed — retrying parse only (no second LLM call)');
    result = tryParseGateResponse(raw.trim(), step);
  }

  if (!result) {
    console.error('[gate] Could not parse LLM response');
    const runUrl = buildRunUrl();
    return {
      proceed: false,
      issues: [],
      summary: `LLM response could not be parsed. Human review required.${runUrl ? ` [View workflow logs](${runUrl})` : ''}`,
    };
  }

  console.log(`[gate] Result: proceed=${result.proceed} issues=${result.issues.length}`);
  return result;
}
