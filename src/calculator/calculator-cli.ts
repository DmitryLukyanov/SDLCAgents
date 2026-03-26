#!/usr/bin/env node
/**
 * Calculator CLI entry point.
 *
 * Usage:
 *   <num> <op> <num>   Binary operations: +, -, *, /
 *   sin <num>          Sine of a number (radians)
 *
 * Negative numbers: use -- to separate flags from arguments, e.g.:
 *   -- -5 + 3
 */

import { add, subtract, multiply, divide, sin, formatResult } from './calculator.js';

const rawArgs = process.argv.slice(2);

// Strip leading '--' separator used to pass negative numbers
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

function printUsage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  calculator <num> <op> <num>   (op: +, -, *, /)\n' +
      '  calculator sin <num>\n',
  );
}

function parseNumber(s: string, label: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) {
    process.stderr.write(`Error: "${s}" is not a valid number for ${label}\n`);
    process.exit(1);
  }
  return n;
}

if (args.length === 2 && args[0]?.toLowerCase() === 'sin') {
  // Unary: sin <num>
  const a = parseNumber(args[1] ?? '', 'argument');
  const result = sin(a);
  process.stdout.write(formatResult(result) + '\n');
} else if (args.length === 3) {
  // Binary: <num> <op> <num>
  const a = parseNumber(args[0] ?? '', 'first operand');
  const op = args[1];
  const b = parseNumber(args[2] ?? '', 'second operand');

  let result: number;
  try {
    switch (op) {
      case '+':
        result = add(a, b);
        break;
      case '-':
        result = subtract(a, b);
        break;
      case '*':
        result = multiply(a, b);
        break;
      case '/':
        result = divide(a, b);
        break;
      default:
        process.stderr.write(`Error: Unknown operator "${op}". Supported: +, -, *, /\n`);
        process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  process.stdout.write(formatResult(result) + '\n');
} else {
  process.stderr.write('Error: Invalid arguments.\n');
  printUsage();
  process.exit(1);
}
