/**
 * Local calculator debug / smoke-test script.
 * Run: npx tsx tests/calculator/calculator.local-debug.ts
 *
 * Mirrors the style of tests/scrum-agent/scrum-master.local-debug.ts.
 */
import { add, subtract, multiply, divide, sin } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(description: string, actual: number, expected: number, tolerance = 1e-10): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✅ ${description}: ${actual}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertThrows(description: string, fn: () => unknown, expectedMessage?: string): void {
  try {
    fn();
    console.error(`  ❌ ${description}: expected an error to be thrown, but none was thrown`);
    failed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (expectedMessage !== undefined && !msg.includes(expectedMessage)) {
      console.error(`  ❌ ${description}: error message "${msg}" does not include "${expectedMessage}"`);
      failed++;
    } else {
      console.log(`  ✅ ${description}: threw "${msg}"`);
      passed++;
    }
  }
}

console.log('\n=== Calculator smoke tests ===\n');

console.log('--- add ---');
assert('add(2, 3)', add(2, 3), 5);
assert('add(-1, 1)', add(-1, 1), 0);
assert('add(0.1, 0.2)', add(0.1, 0.2), 0.30000000000000004, 1e-15);

console.log('\n--- subtract ---');
assert('subtract(10, 4)', subtract(10, 4), 6);
assert('subtract(0, 5)', subtract(0, 5), -5);

console.log('\n--- multiply ---');
assert('multiply(3, 4)', multiply(3, 4), 12);
assert('multiply(-2, 5)', multiply(-2, 5), -10);
assert('multiply(0, 99)', multiply(0, 99), 0);

console.log('\n--- divide ---');
assert('divide(10, 2)', divide(10, 2), 5);
assert('divide(7, 2)', divide(7, 2), 3.5);
assert('divide(-9, 3)', divide(-9, 3), -3);

console.log('\n--- divide: error cases ---');
assertThrows('divide(5, 0) throws', () => divide(5, 0), 'Division by zero');

console.log('\n--- sin ---');
assert('sin(0)', sin(0), 0);
assert('sin(Math.PI / 2)', sin(Math.PI / 2), 1);
assert('sin(Math.PI)', sin(Math.PI), 0);

console.log('\n--- invalid inputs ---');
assertThrows('add(NaN, 1) throws', () => add(NaN, 1), 'finite number');
assertThrows('multiply(Infinity, 2) throws', () => multiply(Infinity, 2), 'finite number');
assertThrows('sin(Infinity) throws', () => sin(Infinity), 'finite number');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
