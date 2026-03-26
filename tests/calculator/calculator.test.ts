/**
 * Calculator library tests.
 * Run: npm run calculator:test
 */
import { calculate, sinDeg, sinRad, DivisionByZeroError } from '../../src/lib/calculator.js';

let passed = 0;
let failed = 0;

function assert(description: string, actual: unknown, expected: unknown, tolerance = 0): void {
  const ok =
    tolerance > 0
      ? Math.abs((actual as number) - (expected as number)) <= tolerance
      : actual === expected;
  if (ok) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertThrows(description: string, fn: () => unknown, ErrorClass: new () => Error): void {
  try {
    fn();
    console.error(`  ✗ ${description}: expected an error but none was thrown`);
    failed++;
  } catch (e) {
    if (e instanceof ErrorClass) {
      console.log(`  ✓ ${description}`);
      passed++;
    } else {
      console.error(`  ✗ ${description}: wrong error type: ${e}`);
      failed++;
    }
  }
}

console.log('--- Calculator: binary operations ---');
assert('add: 3 + 5 = 8', calculate('add', 3, 5), 8);
assert('add: -1 + 1 = 0', calculate('add', -1, 1), 0);
assert('subtract: 10 - 4 = 6', calculate('subtract', 10, 4), 6);
assert('subtract: 5 - 9 = -4', calculate('subtract', 5, 9), -4);
assert('multiply: 6 * 7 = 42', calculate('multiply', 6, 7), 42);
assert('multiply: 0 * 100 = 0', calculate('multiply', 0, 100), 0);
assert('divide: 15 / 3 = 5', calculate('divide', 15, 3), 5);
assert('divide: 1 / 4 = 0.25', calculate('divide', 1, 4), 0.25);
assertThrows('divide by zero throws DivisionByZeroError', () => calculate('divide', 1, 0), DivisionByZeroError);

console.log('\n--- Calculator: sin (degrees) ---');
assert('sin(0°) = 0', sinDeg(0), 0, 1e-10);
assert('sin(90°) = 1', sinDeg(90), 1, 1e-10);
assert('sin(180°) ≈ 0', sinDeg(180), 0, 1e-10);
assert('sin(30°) = 0.5', sinDeg(30), 0.5, 1e-10);
assert('sin(-90°) = -1', sinDeg(-90), -1, 1e-10);

console.log('\n--- Calculator: sin (radians) ---');
assert('sin(0) = 0', sinRad(0), 0, 1e-10);
assert('sin(π/2) = 1', sinRad(Math.PI / 2), 1, 1e-10);
assert('sin(π) ≈ 0', sinRad(Math.PI), 0, 1e-10);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
