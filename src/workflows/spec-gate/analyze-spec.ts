/**
 * Spec Gate — LLM-based artifact analysis via GitHub Models API.
 *
 * Reads spec-kit artifacts for a given pipeline step and asks the LLM
 * to detect open questions, clarification markers, and other blockers.
 * The implement step always yields proceed=false regardless of LLM output.
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

/* ------------------------------------------------------------------ */
/*  GitHub Models API call                                             */
/* ------------------------------------------------------------------ */

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';
const TIMEOUT_MS = 120_000;
const MAX_PROMPT_CHARS = 28_000; // stay well within context limits

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

async function callGitHubModels(
  prompt: string,
  token: string,
  model: string = DEFAULT_MODEL,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_MODELS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: GATE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      throw new Error(`GitHub Models API returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

function buildPrompt(step: SpeckitStep, files: Map<string, string>): string {
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

/* ------------------------------------------------------------------ */
/*  Response parsing                                                   */
/* ------------------------------------------------------------------ */

function parseGateResponse(raw: string, step: SpeckitStep): GateAnalysisResult | null {
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

    // Hard safety override: implement step never auto-proceeds
    if (step === 'implement') {
      result.proceed = false;
      if (!result.summary.toLowerCase().includes('human review')) {
        result.summary = `Implementation complete — human review required before merging. ${result.summary}`.trim();
      }
    }

    return result;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function analyzeSpec(
  step: SpeckitStep,
  files: Map<string, string>,
  githubToken: string,
  model?: string,
): Promise<GateAnalysisResult> {
  if (files.size === 0) {
    console.warn('[gate] No files to analyze — defaulting to HIL');
    return {
      proceed: false,
      issues: [],
      summary: 'No spec artifacts could be read. Human review required.',
    };
  }

  const prompt = buildPrompt(step, files);
  console.log(`[gate] Analyzing step="${step}" files=${[...files.keys()].join(', ')} prompt=${prompt.length} chars`);

  let rawResponse: string;
  try {
    rawResponse = await callGitHubModels(prompt, githubToken, model);
  } catch (err) {
    console.error('[gate] GitHub Models API call failed:', err);
    return {
      proceed: false,
      issues: [],
      summary: 'LLM analysis failed due to an API error. Human review required.',
    };
  }

  console.log(`[gate] LLM raw response (first 300 chars): ${rawResponse.slice(0, 300)}`);

  let result = parseGateResponse(rawResponse, step);

  // Retry once on parse failure
  if (!result) {
    console.warn('[gate] First parse failed — retrying');
    try {
      rawResponse = await callGitHubModels(prompt, githubToken, model);
      result = parseGateResponse(rawResponse, step);
    } catch {
      // ignore retry failure
    }
  }

  if (!result) {
    console.error('[gate] Could not parse LLM response after 2 attempts');
    return {
      proceed: false,
      issues: [],
      summary: 'LLM response could not be parsed. Human review required.',
    };
  }

  console.log(`[gate] Result: proceed=${result.proceed} issues=${result.issues.length}`);
  return result;
}
