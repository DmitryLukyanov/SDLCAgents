/**
 * Declarative `runIf` on pipeline steps (agent JSON `params.steps[]`).
 *
 * Evaluated against {@link PipelineRunIfContext} after prior steps (and, on async parent resume,
 * after `invocation-output-status.json` is loaded into `asyncStepOutputById`).
 *
 * Supported forms:
 *   • `ba_complete` / `ba_incomplete` — use `ctx.baOutcome` (after `apply_ba_outcome`).
 *   • `<asyncStepId>.output.<field> = <literal>` — reads `ctx.asyncStepOutputById[asyncStepId].output[field]`.
 *     Literals: `true`, `false`, `null` (case-insensitive for booleans).
 *
 * Steps with `async_call` ignore `runIf` — skipping async dispatch by predicate is unsupported.
 */

import type { PipelineStepConfig } from './pipeline-config.js';

/** Minimal context shape for runIf evaluation (AI Teammate RunnerContext satisfies this). */
export interface PipelineRunIfContext {
  baOutcome?: { status: string };
  asyncStepOutputById?: Record<string, { output: Record<string, unknown> }>;
}

const LEGACY_TOKENS = new Set(['ba_complete', 'ba_incomplete']);

/** `<stepId>.output.<name> = <literal>` — single field under the status JSON `output` envelope. */
const ASYNC_OUTPUT_EXPR = /^\s*([\w-]+)\.output\.(\w+)\s*=\s*(true|false|null)\s*$/i;

function parseRhsLiteral(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  throw new Error(`[pipeline-run-if] invalid literal "${raw}"`);
}

function valuesEqual(a: unknown, b: boolean | null): boolean {
  return a === b;
}

function evaluateAsyncOutputPredicate(
  ctx: PipelineRunIfContext,
  stepId: string,
  field: string,
  rhs: boolean | null,
  runIfRaw: string,
): boolean {
  const env = ctx.asyncStepOutputById?.[stepId]?.output;
  if (!env) {
    throw new Error(
      `runIf "${runIfRaw}" requires async output envelope for step "${stepId}" (ctx.asyncStepOutputById). ` +
        'Declare contract.outputParams.outputStatus, ensure business-analyst.yml uploads ' +
        'caller-handoff_ba_invocation_status, and that the parent resume job downloads it.',
    );
  }
  return valuesEqual(env[field], rhs);
}

/**
 * @returns whether the step should execute (false → skip like disabled, with audit reason).
 */
export function shouldRunPipelineStepByRunIf(
  step: PipelineStepConfig,
  ctx: PipelineRunIfContext,
): { execute: boolean; token?: string } {
  if (step.async_call) {
    return { execute: true };
  }

  const raw = step.runIf;
  if (raw === undefined || raw === null) {
    return { execute: true };
  }
  if (typeof raw !== 'string') {
    throw new Error(
      `Pipeline step runIf must be a string when set (step id "${String(step.id)}", runner "${step.runner}").`,
    );
  }
  const token = raw.trim();
  if (!token) {
    return { execute: true };
  }

  const m = token.match(ASYNC_OUTPUT_EXPR);
  if (m) {
    const stepId = m[1]!;
    const field = m[2]!;
    const rhs = parseRhsLiteral(m[3]!);
    const execute = evaluateAsyncOutputPredicate(ctx, stepId, field, rhs, token);
    return { execute, token };
  }

  if (!LEGACY_TOKENS.has(token)) {
    throw new Error(
      `Unknown pipeline runIf "${token}" (step id "${String(step.id)}", runner "${step.runner}"). ` +
        `Supported: "ba_complete", "ba_incomplete", or "<asyncStepId>.output.<field> = <true|false|null>".`,
    );
  }

  if (token === 'ba_complete') {
    return { execute: ctx.baOutcome?.status === 'complete', token };
  }
  return { execute: ctx.baOutcome?.status === 'incomplete', token };
}
