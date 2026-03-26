/**
 * Calculator CLI entry point.
 *
 * Usage:
 *   tsx src/calculator/calculator-cli.ts <operation> [operand1] [operand2]
 *
 * Operations:
 *   add <a> <b>       → a + b
 *   subtract <a> <b>  → a - b
 *   multiply <a> <b>  → a * b
 *   divide <a> <b>    → a / b  (errors on b=0)
 *   sin <x>           → Math.sin(x) (x in radians)
 */
import { add, subtract, multiply, divide, sin } from './calculator.js';

const BINARY_OPS = new Set(['add', 'subtract', 'multiply', 'divide']);
const UNARY_OPS = new Set(['sin']);

function parseNumber(raw: string | undefined, label: string): number {
  if (raw === undefined) {
    console.error(`Error: missing ${label}`);
    process.exit(1);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.error(`Error: "${raw}" is not a valid number for ${label}`);
    process.exit(1);
  }
  return n;
}

function main(): void {
  const [, , op, rawA, rawB] = process.argv;

  if (!op) {
    console.error('Usage: calculator <operation> [operand1] [operand2]');
    console.error('Operations: add, subtract, multiply, divide, sin');
    process.exit(1);
  }

  let result: number;

  if (BINARY_OPS.has(op)) {
    const a = parseNumber(rawA, 'operand1');
    const b = parseNumber(rawB, 'operand2');
    try {
      if (op === 'add') result = add(a, b);
      else if (op === 'subtract') result = subtract(a, b);
      else if (op === 'multiply') result = multiply(a, b);
      else result = divide(a, b);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else if (UNARY_OPS.has(op)) {
    const x = parseNumber(rawA, 'operand');
    result = sin(x);
  } else {
    console.error(`Error: unknown operation "${op}"`);
    console.error('Operations: add, subtract, multiply, divide, sin');
    process.exit(1);
  }

  console.log(result);
}

main();
