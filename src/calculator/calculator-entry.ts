/**
 * Simple calculator CLI.
 *
 * Usage:
 *   npx tsx src/calculator/calculator-entry.ts add 3 5
 *   npx tsx src/calculator/calculator-entry.ts subtract 10 4
 *   npx tsx src/calculator/calculator-entry.ts multiply 6 7
 *   npx tsx src/calculator/calculator-entry.ts divide 15 3
 *   npx tsx src/calculator/calculator-entry.ts sin 90        # degrees
 *   npx tsx src/calculator/calculator-entry.ts sin-rad 1.5708  # radians
 */
import { calculate, sinDeg, sinRad, type BinaryOperation, DivisionByZeroError } from '../lib/calculator.js';

const BINARY_OPS = new Set<string>(['add', 'subtract', 'multiply', 'divide']);

function usage(): void {
  console.error(
    'Usage: calculator <add|subtract|multiply|divide> <a> <b>\n' +
      '       calculator sin <degrees>\n' +
      '       calculator sin-rad <radians>',
  );
}

function main(): void {
  const [, , op, ...args] = process.argv;

  if (!op) {
    usage();
    process.exit(1);
  }

  if (op === 'sin' || op === 'sin-rad') {
    if (args.length !== 1) {
      usage();
      process.exit(1);
    }
    const value = parseFloat(args[0]);
    if (Number.isNaN(value)) {
      console.error(`Error: "${args[0]}" is not a valid number.`);
      process.exit(1);
    }
    const result = op === 'sin' ? sinDeg(value) : sinRad(value);
    console.log(result);
    return;
  }

  if (BINARY_OPS.has(op)) {
    if (args.length !== 2) {
      usage();
      process.exit(1);
    }
    const a = parseFloat(args[0]);
    const b = parseFloat(args[1]);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      console.error(`Error: operands must be valid numbers.`);
      process.exit(1);
    }
    try {
      const result = calculate(op as BinaryOperation, a, b);
      console.log(result);
    } catch (e) {
      if (e instanceof DivisionByZeroError) {
        console.error('Error: Division by zero.');
        process.exit(1);
      }
      throw e;
    }
    return;
  }

  console.error(`Unknown operation: "${op}".`);
  usage();
  process.exit(1);
}

main();
