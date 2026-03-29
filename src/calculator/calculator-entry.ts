/**
 * Calculator CLI entry point.
 *
 * Usage:
 *   npm run calculator add 3 4
 *   npm run calculator subtract 10 3
 *   npm run calculator multiply 2 5
 *   npm run calculator divide 8 2
 *   npm run calculator sin 1.5707963267948966
 */
import { calculate, type CalculatorInput } from './calculator.js';

function printUsage(): void {
  console.error('Usage: calculator <operation> <a> [b]');
  console.error('  Operations: add, subtract, multiply, divide, sin');
  console.error('  Binary (requires a and b): add, subtract, multiply, divide');
  console.error('  Unary  (requires a only):  sin');
}

function run(): void {
  const [, , operation, rawA, rawB] = process.argv;

  if (!operation || !rawA) {
    printUsage();
    process.exit(1);
  }

  const a = parseFloat(rawA);
  if (Number.isNaN(a)) {
    console.error(`Invalid number: ${rawA}`);
    process.exit(1);
  }

  let input: CalculatorInput;

  if (operation === 'sin') {
    input = { operation: 'sin', a };
  } else {
    if (!rawB) {
      printUsage();
      process.exit(1);
    }
    const b = parseFloat(rawB);
    if (Number.isNaN(b)) {
      console.error(`Invalid number: ${rawB}`);
      process.exit(1);
    }
    if (
      operation !== 'add' &&
      operation !== 'subtract' &&
      operation !== 'multiply' &&
      operation !== 'divide'
    ) {
      console.error(`Unknown operation: ${operation}`);
      printUsage();
      process.exit(1);
    }
    input = { operation, a, b };
  }

  try {
    const { result } = calculate(input);
    console.log(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

run();
