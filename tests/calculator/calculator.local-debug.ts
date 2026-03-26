/**
 * Calculator local-debug / smoke-test.
 * Run: npm run calculator:debug
 * Exercises all five operations and asserts expected values.
 */
import { add, subtract, multiply, divide, sin } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number, tolerance = 1e-9): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✅ ${label}: ${actual}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertThrows(label: string, fn: () => unknown, expectedMsg: string): void {
  try {
    fn();
    console.error(`  ❌ ${label}: expected to throw but did not`);
    failed++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === expectedMsg) {
      console.log(`  ✅ ${label}: threw "${msg}"`);
      passed++;
    } else {
      console.error(`  ❌ ${label}: expected message "${expectedMsg}", got "${msg}"`);
      failed++;
    }
  }
}

console.log('=== Calculator local-debug ===\n');

console.log('add:');
assert('add(3, 4)', add(3, 4), 7);
assert('add(-1, 1)', add(-1, 1), 0);
assert('add(0.1, 0.2)', add(0.1, 0.2), 0.3, 1e-9);

console.log('\nsubtract:');
assert('subtract(10, 3)', subtract(10, 3), 7);
assert('subtract(0, 5)', subtract(0, 5), -5);

console.log('\nmultiply:');
assert('multiply(6, 7)', multiply(6, 7), 42);
assert('multiply(-3, 4)', multiply(-3, 4), -12);
assert('multiply(0, 99)', multiply(0, 99), 0);

console.log('\ndivide:');
assert('divide(10, 2)', divide(10, 2), 5);
assert('divide(7, 2)', divide(7, 2), 3.5);
assertThrows('divide(1, 0)', () => divide(1, 0), 'Division by zero');

console.log('\nsin:');
assert('sin(0)', sin(0), 0);
assert('sin(Math.PI/6) ≈ 0.5', sin(Math.PI / 6), 0.5, 1e-9);
assert('sin(Math.PI/2) = 1', sin(Math.PI / 2), 1, 1e-9);
assert('sin(Math.PI) ≈ 0', sin(Math.PI), 0, 1e-9);

console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
