/**
 * Unit tests for the calculator module.
 * Run: npx tsx tests/calculator/calculator.test.ts
 */
import { calculate } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(description: string, actual: number, expected: number, tolerance = 1e-10): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertThrows(description: string, fn: () => unknown, expectedMessage: string): void {
  try {
    fn();
    console.error(`  ✗ ${description}: expected an error but none was thrown`);
    failed++;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes(expectedMessage)) {
      console.log(`  ✓ ${description}`);
      passed++;
    } else {
      console.error(`  ✗ ${description}: expected "${expectedMessage}", got "${message}"`);
      failed++;
    }
  }
}

console.log('Calculator tests');

console.log('\nadd');
assert('2 + 3 = 5', calculate({ operation: 'add', a: 2, b: 3 }).result, 5);
assert('0 + 0 = 0', calculate({ operation: 'add', a: 0, b: 0 }).result, 0);
assert('-1 + 1 = 0', calculate({ operation: 'add', a: -1, b: 1 }).result, 0);

console.log('\nsubtract');
assert('10 - 3 = 7', calculate({ operation: 'subtract', a: 10, b: 3 }).result, 7);
assert('0 - 5 = -5', calculate({ operation: 'subtract', a: 0, b: 5 }).result, -5);

console.log('\nmultiply');
assert('3 * 4 = 12', calculate({ operation: 'multiply', a: 3, b: 4 }).result, 12);
assert('-2 * 5 = -10', calculate({ operation: 'multiply', a: -2, b: 5 }).result, -10);
assert('0 * 100 = 0', calculate({ operation: 'multiply', a: 0, b: 100 }).result, 0);

console.log('\ndivide');
assert('8 / 2 = 4', calculate({ operation: 'divide', a: 8, b: 2 }).result, 4);
assert('1 / 3 ≈ 0.333...', calculate({ operation: 'divide', a: 1, b: 3 }).result, 1 / 3);
assertThrows('division by zero throws', () => calculate({ operation: 'divide', a: 5, b: 0 }), 'Division by zero');

console.log('\nsin');
assert('sin(0) = 0', calculate({ operation: 'sin', a: 0 }).result, 0);
assert('sin(π/2) = 1', calculate({ operation: 'sin', a: Math.PI / 2 }).result, 1);
assert('sin(π) ≈ 0', calculate({ operation: 'sin', a: Math.PI }).result, 0, 1e-10);
assert('sin(-π/2) = -1', calculate({ operation: 'sin', a: -Math.PI / 2 }).result, -1);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
