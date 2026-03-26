/**
 * Calculator CLI entry point.
 *
 * Usage:
 *   npm run calculator add <a> <b>
 *   npm run calculator subtract <a> <b>
 *   npm run calculator multiply <a> <b>
 *   npm run calculator divide <a> <b>
 *   npm run calculator sin <x>
 */
import { Calculator } from './calculator.js';

const OPERATIONS_TWO_ARGS = new Set(['add', 'subtract', 'multiply', 'divide']);
const OPERATIONS_ONE_ARG = new Set(['sin']);

function printUsage(): void {
  console.log('Usage:');
  console.log('  calculator add <a> <b>');
  console.log('  calculator subtract <a> <b>');
  console.log('  calculator multiply <a> <b>');
  console.log('  calculator divide <a> <b>');
  console.log('  calculator sin <x>          (x in radians)');
}

function main(): void {
  const [, , op, rawA, rawB] = process.argv;

  if (!op) {
    printUsage();
    process.exit(1);
  }

  if (OPERATIONS_TWO_ARGS.has(op)) {
    if (rawA === undefined || rawB === undefined) {
      console.error(`Operation "${op}" requires two operands.`);
      printUsage();
      process.exit(1);
    }
    const a = Number(rawA);
    const b = Number(rawB);
    if (isNaN(a)) {
      console.error(`First operand "${rawA}" is not a valid number.`);
      process.exit(1);
    }
    if (isNaN(b)) {
      console.error(`Second operand "${rawB}" is not a valid number.`);
      process.exit(1);
    }

    let result: number;
    switch (op) {
      case 'add':
        result = Calculator.add(a, b);
        break;
      case 'subtract':
        result = Calculator.subtract(a, b);
        break;
      case 'multiply':
        result = Calculator.multiply(a, b);
        break;
      case 'divide':
        try {
          result = Calculator.divide(a, b);
        } catch (err) {
          console.error((err as Error).message);
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown operation: ${op}`);
        printUsage();
        process.exit(1);
    }

    console.log(`${op}(${a}, ${b}) = ${result}`);
    return;
  }

  if (OPERATIONS_ONE_ARG.has(op)) {
    if (rawA === undefined) {
      console.error(`Operation "${op}" requires one operand.`);
      printUsage();
      process.exit(1);
    }
    const x = Number(rawA);
    if (isNaN(x)) {
      console.error(`Operand "${rawA}" is not a valid number.`);
      process.exit(1);
    }
    const result = Calculator.sin(x);
    console.log(`${op}(${x}) = ${result}`);
    return;
  }

  console.error(`Unknown operation: ${op}`);
  printUsage();
  process.exit(1);
}

main();
