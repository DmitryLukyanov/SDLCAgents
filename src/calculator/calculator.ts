import { parse } from './parser.js';
import type {
  ParsedExpression,
  BinaryExpression,
  UnaryExpression,
  CalculatorResult,
} from './types.js';
import { Operation } from './types.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Converts degrees to radians and returns Math.sin of the result. */
export function sinDegrees(degrees: number): number {
  return Math.sin((degrees * Math.PI) / 180);
}

// ── evaluate ──────────────────────────────────────────────────────────────────

export function evaluate(expr: ParsedExpression): CalculatorResult {
  let value: number;

  if (expr.kind === 'binary') {
    const { operator, left, right } = expr as BinaryExpression;

    // Guard division by zero before computing
    if (operator === Operation.Divide && right === 0) {
      return { kind: 'error', message: 'Division by zero is not allowed.' };
    }

    switch (operator) {
      case Operation.Add:      value = left + right; break;
      case Operation.Subtract: value = left - right; break;
      case Operation.Multiply: value = left * right; break;
      case Operation.Divide:   value = left / right; break;
    }
  } else {
    // Unary expression (sin)
    const { operand } = expr as UnaryExpression;
    value = sinDegrees(operand);
  }

  // Post-compute overflow / NaN guard
  if (!isFinite(value) || isNaN(value)) {
    return { kind: 'error', message: 'Result is out of numeric range.' };
  }

  return { kind: 'success', value };
}

// ── calculate (facade) ────────────────────────────────────────────────────────

/**
 * Public façade: parses the raw string, then evaluates the expression.
 * Never throws — all error conditions are returned as `ErrorResult`.
 */
export function calculate(expression: string): CalculatorResult {
  const parsed = parse(expression);

  if (parsed.kind === 'parse-error') {
    return { kind: 'error', message: parsed.message };
  }

  return evaluate(parsed);
}
