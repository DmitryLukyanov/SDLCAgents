/**
 * Calculator CLI entry point.
 * Usage: npm run calculator -- <operation> <a> [b]
 * Operations: add, subtract, multiply, divide, sin
 * Examples:
 *   npm run calculator -- add 3 4        → 7
 *   npm run calculator -- sin 1.5707963  → 1
 */
import { add, subtract, multiply, divide, sin } from './calculator.js';

const USAGE = `Usage: calculator <operation> <a> [b]
Operations:
  add <a> <b>       a + b
  subtract <a> <b>  a - b
  multiply <a> <b>  a * b
  divide <a> <b>    a / b
  sin <a>           sin(a) in radians
`;

function parseNum(s: string, label: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) {
    console.error(`Error: ${label} must be a finite number, got "${s}"`);
    process.exit(1);
  }
  return n;
}

const [, , op, rawA, rawB] = process.argv;

if (!op || !rawA) {
  process.stdout.write(USAGE);
  process.exit(1);
}

const a = parseNum(rawA, 'a');

let result: number;
try {
  switch (op) {
    case 'add':
      result = add(a, parseNum(rawB ?? '', 'b'));
      break;
    case 'subtract':
      result = subtract(a, parseNum(rawB ?? '', 'b'));
      break;
    case 'multiply':
      result = multiply(a, parseNum(rawB ?? '', 'b'));
      break;
    case 'divide':
      result = divide(a, parseNum(rawB ?? '', 'b'));
      break;
    case 'sin':
      result = sin(a);
      break;
    default:
      console.error(`Error: unknown operation "${op}"`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

console.log(result!);
