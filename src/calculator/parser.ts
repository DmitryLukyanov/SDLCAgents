import type { ParseResult, BinaryExpression, UnaryExpression } from './types.js';
import { Operation } from './types.js';

// ── Error message catalogue ───────────────────────────────────────────────────

const MSG_BLANK         = 'Please enter a valid expression.';
const MSG_UNSUPPORTED   = 'Unsupported operation. Supported: +, -, *, /, sin.';
const MSG_INCOMPLETE    = 'Incomplete expression. Expected: <number> <+|-|*|/> <number>.';
const MSG_INVALID       = 'Invalid expression. Try: 5 + 3 or sin(30).';

// ── Regex patterns ────────────────────────────────────────────────────────────

// Unary: sin(number) — checked BEFORE binary so "sin(30)" wins
const UNARY_SIN_RE = /^sin\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)$/i;

// Binary: <number> <op> <number> with supported operators only
const BINARY_RE = /^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/;

// Chained: e.g. "1 + 2 + 3" — two or more operators between numbers
// Must be checked BEFORE incomplete so we return MSG_INVALID not MSG_INCOMPLETE
const CHAINED_RE = /^-?\d+(?:\.\d+)?(?:\s*[+\-*/]\s*-?\d+(?:\.\d+)?){2,}$/;

// Incomplete binary: trailing operator ("5 +") or leading operator ("* 3")
const INCOMPLETE_TRAILING_RE = /^-?\d+(?:\.\d+)?\s*[+\-*/]\s*$/;
const INCOMPLETE_LEADING_RE  = /^\s*[+\-*/]\s*(-?\d+(?:\.\d+)?)?$/;

// Unsupported function call: e.g. cos(...), tan(...)
const UNSUPPORTED_FUNC_RE = /^[a-zA-Z]+\s*\(/;

// Unsupported operator token: has an operator that is not one of + - * /
const UNSUPPORTED_OP_RE = /[%^]/;

// ── Operator map ──────────────────────────────────────────────────────────────

const OPERATOR_MAP: Record<string, Operation.Add | Operation.Subtract | Operation.Multiply | Operation.Divide> = {
  '+': Operation.Add,
  '-': Operation.Subtract,
  '*': Operation.Multiply,
  '/': Operation.Divide,
};

// ── parse ─────────────────────────────────────────────────────────────────────

export function parse(input: string): ParseResult {
  const trimmed = input.trim();

  // 1. Blank / whitespace-only
  if (trimmed.length === 0) {
    return { kind: 'parse-error', message: MSG_BLANK };
  }

  // 2. Unary sin() — must come before binary so "sin(30)" does not fall through
  const sinMatch = UNARY_SIN_RE.exec(trimmed);
  if (sinMatch) {
    const result: UnaryExpression = {
      kind: 'unary',
      operator: Operation.Sin,
      operand: parseFloat(sinMatch[1]!),
    };
    return result;
  }

  // 3. Unsupported function call (e.g. cos(...), tan(...))
  if (UNSUPPORTED_FUNC_RE.test(trimmed)) {
    return { kind: 'parse-error', message: MSG_UNSUPPORTED };
  }

  // 4. Binary — happy path
  const binMatch = BINARY_RE.exec(trimmed);
  if (binMatch) {
    const operator = OPERATOR_MAP[binMatch[2]!]!;
    const result: BinaryExpression = {
      kind: 'binary',
      operator,
      left:  parseFloat(binMatch[1]!),
      right: parseFloat(binMatch[3]!),
    };
    return result;
  }

  // 5. Chained expression (e.g. "1 + 2 + 3"): two or more operators between numbers
  //    Must be tested BEFORE incomplete to avoid misclassification
  if (CHAINED_RE.test(trimmed)) {
    return { kind: 'parse-error', message: MSG_INVALID };
  }

  // 6. Incomplete binary: trailing operator ("5 +") or leading operator ("* 3")
  if (INCOMPLETE_TRAILING_RE.test(trimmed) || INCOMPLETE_LEADING_RE.test(trimmed)) {
    return { kind: 'parse-error', message: MSG_INCOMPLETE };
  }

  // 7. Unsupported operator tokens (%, ^, etc.)
  if (UNSUPPORTED_OP_RE.test(trimmed)) {
    return { kind: 'parse-error', message: MSG_UNSUPPORTED };
  }

  // 8. Catch-all: unrecognised pattern
  return { kind: 'parse-error', message: MSG_INVALID };
}

