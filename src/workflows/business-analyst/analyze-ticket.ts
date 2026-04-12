/**
 * Business Analyst — prompt building and Codex output parsing.
 *
 * CI runs analysis via `openai/codex-action@v1`; this module supplies the BA
 * system prompt, ticket payload text, and JSON interpretation of model output.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BaAnalysisResult,
  BaOutcome,
  TicketContext,
} from './ba-types.js';
import { fillTemplate, loadTemplate } from '../../lib/template-utils.js';

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */

const ANALYSIS_SYSTEM_PROMPT = readFileSync(
  join(fileURLToPath(import.meta.url), '..', 'prompts', 'analysis-system-prompt.md'),
  'utf8',
).trim();

const BA_MISSING_INFO_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'ba-missing-information.md');

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

/** Plain-text ticket payload for the BA model (Codex). */
export function buildBaTicketPrompt(ctx: TicketContext): string {
  const parts: string[] = [];

  parts.push(`# Jira Ticket: ${ctx.issueKey}`);
  parts.push(`## Summary\n${ctx.summary}`);

  if (ctx.description) {
    parts.push(`## Description\n${ctx.description}`);
  }

  // Separate BA-generated comments from regular user comments.
  // When a BA question comment is immediately followed by user comments, present
  // them as a Q&A pair so the LLM understands the user is answering the BA's questions.
  const regularComments = ctx.comments.filter((c) => !c.isBAGenerated);
  const baQuestionComments = ctx.comments.filter(
    (c) => c.isBAGenerated && c.body.includes('Missing Information'),
  );

  console.log(`[BA] buildPrompt: total=${ctx.comments.length} ba-generated=${ctx.comments.length - regularComments.length} user=${regularComments.length} ba-questions=${baQuestionComments.length}`);

  if (baQuestionComments.length > 0 && regularComments.length > 0) {
    const lastBAComment = baQuestionComments[baQuestionComments.length - 1];
    const userReplies = ctx.comments.filter(
      (c) => !c.isBAGenerated && c.created > lastBAComment.created,
    );
    const earlierComments = regularComments.filter(
      (c) => c.created <= lastBAComment.created,
    );

    console.log(`[BA] buildPrompt: lastBAComment=${lastBAComment.created} userReplies=${userReplies.length} earlierComments=${earlierComments.length}`);

    if (earlierComments.length > 0) {
      parts.push('## Comments (chronological)');
      for (const c of earlierComments) {
        parts.push(`### ${c.author} (${c.created})\n${c.body}`);
      }
    }

    if (userReplies.length > 0) {
      parts.push('## User Answers to BA Questions');
      parts.push(
        'The automated Business Analyst previously asked clarifying questions about this ticket. ' +
        "The following are the user's replies. Use these answers — including any delegation " +
        'language like "take best options", "use your judgment", "choose the best approach" — ' +
        'as permission to generate appropriate content for any missing fields.',
      );
      for (const c of userReplies) {
        parts.push(`### ${c.author} (${c.created})\n${c.body}`);
      }
    }
  } else if (regularComments.length > 0) {
    console.log(`[BA] buildPrompt: no BA questions found — using flat comment list`);
    parts.push('## Comments (chronological)');
    for (const c of regularComments) {
      parts.push(`### ${c.author} (${c.created})\n${c.body}`);
    }
  }

  if (ctx.relatedIssues.length > 0) {
    parts.push('## Related Issues');
    for (const r of ctx.relatedIssues) {
      parts.push(`- **${r.key}** (${r.type}, ${r.status}): ${r.summary}`);
    }
  }

  const prompt = parts.join('\n\n');
  console.log(`[BA] buildPrompt: final prompt length=${prompt.length} chars`);
  return prompt;
}

/** System instructions loaded from `prompts/analysis-system-prompt.md`. */
export function getBaAnalysisSystemPrompt(): string {
  return ANALYSIS_SYSTEM_PROMPT;
}

/* ------------------------------------------------------------------ */
/*  JSON parsing & validation                                          */
/* ------------------------------------------------------------------ */

/**
 * Accepts a string or a nested object/array from the LLM.
 * Objects are flattened to "key: value\n" lines so downstream agents can still read them.
 */
function coerceToString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value !== null && typeof value === 'object') {
    const lines = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        return `${k}: ${val}`;
      })
      .join('\n');
    return lines.trim() || null;
  }
  return null;
}

function parseAnalysisResponse(raw: string): BaAnalysisResult | null {
  try {
    // Strip markdown fences if the LLM wraps the JSON
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return {
      specifyInput: coerceToString(parsed.specifyInput),
      clarifyInput: coerceToString(parsed.clarifyInput),
      planInput: coerceToString(parsed.planInput),
      tasksInput: coerceToString(parsed.tasksInput),
      implementInput: coerceToString(parsed.implementInput),
    };
  } catch {
    return null;
  }
}

export function isBaAnalysisComplete(result: BaAnalysisResult): boolean {
  // ALL five fields must be populated for the ticket to proceed
  return (
    result.specifyInput !== null &&
    result.clarifyInput !== null &&
    result.planInput !== null &&
    result.tasksInput !== null &&
    result.implementInput !== null
  );
}

function outcomeFromParsedResult(result: BaAnalysisResult, ctx: TicketContext): BaOutcome {
  if (isBaAnalysisComplete(result)) {
    console.log('[BA] Analysis complete — all required fields populated');
    return { status: 'complete', result };
  }
  console.log('[BA] Analysis incomplete — one or more fields missing');
  return {
    status: 'incomplete',
    questions: generateQuestions(result, ctx),
    partialResult: result,
  };
}

/** Turn raw model output (JSON) into a structured BA outcome (Codex BA finish). */
export function interpretBaModelOutput(raw: string, ctx: TicketContext): BaOutcome {
  console.log(`[BA] LLM raw response (first 500 chars): ${raw.slice(0, 500)}`);
  const result = parseAnalysisResponse(raw);
  if (!result) {
    console.error('[BA] Could not parse model response as JSON');
    return {
      status: 'incomplete',
      questions: generateQuestions(null, ctx),
    };
  }
  return outcomeFromParsedResult(result, ctx);
}

const FIELD_LABELS: Array<{ key: keyof BaAnalysisResult; label: string; question: string }> = [
  {
    key: 'specifyInput',
    label: 'Specify (what & why)',
    question: 'What needs to be built? Please describe the feature/change, target users, business value, and success criteria.',
  },
  {
    key: 'clarifyInput',
    label: 'Clarify (ambiguities)',
    question: 'Are there any ambiguities, open questions, unclear behaviors, or assumptions that need to be resolved?',
  },
  {
    key: 'planInput',
    label: 'Plan (technical design)',
    question: 'What is the technical approach? Please describe system design, technology choices, data models, integrations, and non-functional requirements.',
  },
  {
    key: 'tasksInput',
    label: 'Tasks (work items)',
    question: 'What are the concrete, ordered work items? Please list actionable tasks (e.g. "add X", "implement Y", "update Z").',
  },
  {
    key: 'implementInput',
    label: 'Implement (code/artifacts)',
    question: 'Are there any code snippets, file changes, diffs, or implementation artifacts to include?',
  },
];

function generateQuestions(result: BaAnalysisResult | null, _ctx: TicketContext): string {
  const extractionSummary = FIELD_LABELS.map((f) => {
    const value = result?.[f.key];
    return `- ${value ? '✅' : '❌'} **${f.label}**: ${value ? 'found' : 'NOT FOUND'}`;
  }).join('\n');

  const missing = FIELD_LABELS.filter((f) => !result?.[f.key]);
  let questionsSection = '';
  if (missing.length > 0) {
    const qLines: string[] = [
      '### ❓ Please provide the following information',
      '',
    ];
    for (const f of missing) {
      qLines.push(`**${f.label}:** ${f.question}`);
      qLines.push('');
    }
    qLines.push('Once updated, move the ticket back to **To Do** for re-processing.');
    questionsSection = qLines.join('\n');
  }

  return fillTemplate(BA_MISSING_INFO_TEMPLATE, {
    EXTRACTION_SUMMARY: extractionSummary,
    QUESTIONS_SECTION:  questionsSection,
  });
}
