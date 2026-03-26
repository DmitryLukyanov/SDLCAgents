// Types (T004 — Phase 2: Foundational)
export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide';
export type UnaryOperation = 'sin';
export type Operation = BinaryOperation | UnaryOperation;

export type CalcResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

const BINARY_OPS: ReadonlySet<string> = new Set(['add', 'subtract', 'multiply', 'divide']);
const UNARY_OPS: ReadonlySet<string> = new Set(['sin']);
const ALL_OPS = 'add, subtract, multiply, divide, sin';

/**
 * Parse raw CLI argv (everything after `node cli.ts`) into a CalcResult.
 * Returns { ok: false, error } for any validation problem, or calls calculate()
 * and returns its result.
 */
export function parseArgs(argv: string[]): CalcResult {
  // T016 — no-arguments guard
  if (argv.length === 0) {
    return { ok: false, error: 'Usage: calc <operation> [operands...]' };
  }

  const op = argv[0];

  // T017 — unsupported-operation rejection
  if (!BINARY_OPS.has(op) && !UNARY_OPS.has(op)) {
    return {
      ok: false,
      error: `Unsupported operation: "${op}". Supported: ${ALL_OPS}`,
    };
  }

  const operandStrings = argv.slice(1);

  // T018 — wrong-operand-count guards
  if (BINARY_OPS.has(op) && operandStrings.length !== 2) {
    return { ok: false, error: `"${op}" requires 2 numeric operands` };
  }
  if (UNARY_OPS.has(op) && operandStrings.length !== 1) {
    return { ok: false, error: `"${op}" requires 1 numeric operand` };
  }

  // T019 — non-numeric operand validation
  // Note: Number('') === 0 (not NaN), so we must guard empty strings explicitly.
  const operands: number[] = [];
  for (const s of operandStrings) {
    if (s.trim() === '') {
      return { ok: false, error: `Invalid input: "${s}" is not a number` };
    }
    const n = Number(s);
    if (Number.isNaN(n)) {
      return { ok: false, error: `Invalid input: "${s}" is not a number` };
    }
    operands.push(n);
  }

  return calculate(op as Operation, operands);
}

/**
 * Perform the requested calculation. Assumes inputs are already validated.
 * Returns { ok: true, value } or { ok: false, error } for domain errors (e.g. div/0).
 */
export function calculate(op: Operation, operands: number[]): CalcResult {
  switch (op) {
    // T008 — arithmetic (binary)
    case 'add':
      return { ok: true, value: operands[0] + operands[1] };

    case 'subtract':
      return { ok: true, value: operands[0] - operands[1] };

    case 'multiply':
      return { ok: true, value: operands[0] * operands[1] };

    case 'divide':
      // T020 — division-by-zero guard
      if (operands[1] === 0) {
        return { ok: false, error: 'Division by zero' };
      }
      return { ok: true, value: operands[0] / operands[1] };

    // T013 — sine (unary)
    case 'sin':
      return { ok: true, value: Math.sin(operands[0]) };
  }
}
