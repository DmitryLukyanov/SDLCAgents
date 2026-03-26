/**
 * Calculator CLI (TC-5)
 *
 * Usage:
 *   node calculator-cli.ts <operation> <a> [b]
 *
 * Operations: add, subtract, multiply, divide, sin
 *
 * Examples:
 *   node calculator-cli.ts add 3 5          → 8
 *   node calculator-cli.ts multiply 4 7     → 28
 *   node calculator-cli.ts divide 10 2      → 5
 *   node calculator-cli.ts sin 1.5707963268 → 1
 */

import { add, subtract, multiply, divide, sin, CalculatorError } from './calculator.js';

const [, , operation, rawA, rawB] = process.argv;

function usage(): void {
  console.error('Usage: calculator-cli <add|subtract|multiply|divide|sin> <a> [b]');
  process.exit(1);
}

if (!operation || rawA === undefined) {
  usage();
}

const a = Number(rawA);
if (Number.isNaN(a)) {
  console.error(`Invalid number: ${rawA}`);
  process.exit(1);
}

let result: number;

try {
  switch (operation) {
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide': {
      if (rawB === undefined) usage();
      const b = Number(rawB);
      if (Number.isNaN(b)) {
        console.error(`Invalid number: ${rawB}`);
        process.exit(1);
      }
      if (operation === 'add') result = add(a, b);
      else if (operation === 'subtract') result = subtract(a, b);
      else if (operation === 'multiply') result = multiply(a, b);
      else result = divide(a, b);
      break;
    }
    case 'sin':
      result = sin(a);
      break;
    default:
      console.error(`Unknown operation: ${operation}`);
      usage();
  }
} catch (err) {
  if (err instanceof CalculatorError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

console.log(result!);
