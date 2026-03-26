/**
 * Calculator local smoke-test — no test runner needed.
 * Run: npx tsx tests/calculator/calculator.local-debug.ts
 *
 * Follows the pattern of tests/scrum-agent/scrum-master.local-debug.ts.
 */
import { Calculator } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number, epsilon = 1e-10): void {
  const ok = Math.abs(actual - expected) < epsilon;
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertThrows(label: string, fn: () => unknown, expectedMessage: string): void {
  try {
    fn();
    console.error(`  ❌ ${label} — expected an error but none was thrown`);
    failed++;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === expectedMessage) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ ${label} — wrong error message: "${msg}"`);
      failed++;
    }
  }
}

console.log('=== Calculator smoke-test ===\n');

console.log('--- add ---');
assert('add(2, 3) = 5', Calculator.add(2, 3), 5);
assert('add(-1, 1) = 0', Calculator.add(-1, 1), 0);
assert('add(0.1, 0.2) ≈ 0.3', Calculator.add(0.1, 0.2), 0.3, 1e-9);

console.log('\n--- subtract ---');
assert('subtract(10, 4) = 6', Calculator.subtract(10, 4), 6);
assert('subtract(0, 5) = -5', Calculator.subtract(0, 5), -5);

console.log('\n--- multiply ---');
assert('multiply(3, 4) = 12', Calculator.multiply(3, 4), 12);
assert('multiply(-2, 5) = -10', Calculator.multiply(-2, 5), -10);
assert('multiply(0, 999) = 0', Calculator.multiply(0, 999), 0);

console.log('\n--- divide ---');
assert('divide(10, 2) = 5', Calculator.divide(10, 2), 5);
assert('divide(7, 2) = 3.5', Calculator.divide(7, 2), 3.5);
assertThrows('divide(1, 0) throws', () => Calculator.divide(1, 0), 'Division by zero');

console.log('\n--- sin ---');
assert('sin(0) = 0', Calculator.sin(0), 0);
assert('sin(π/2) = 1', Calculator.sin(Math.PI / 2), 1);
assert('sin(π) ≈ 0', Calculator.sin(Math.PI), 0, 1e-10);

console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
