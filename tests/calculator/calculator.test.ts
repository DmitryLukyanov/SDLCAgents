/**
 * Calculator test script — TC-5
 *
 * Validates all acceptance criteria from specs/TC-5/spec.md.
 * Run: tsx tests/calculator/calculator.test.ts
 */
import { add, subtract, multiply, divide, sin } from '../../src/calculator/calculator.js';

let failures = 0;

function assert(description: string, actual: unknown, expected: unknown): void {
  const pass = actual === expected || (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 1e-10);
  if (pass) {
    console.log(`  PASS  ${description}`);
  } else {
    console.error(`  FAIL  ${description} — expected ${String(expected)}, got ${String(actual)}`);
    failures++;
  }
}

function assertThrows(description: string, fn: () => unknown, expectedMessage: string): void {
  try {
    fn();
    console.error(`  FAIL  ${description} — expected Error to be thrown`);
    failures++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === expectedMessage) {
      console.log(`  PASS  ${description}`);
    } else {
      console.error(`  FAIL  ${description} — expected message "${expectedMessage}", got "${msg}"`);
      failures++;
    }
  }
}

console.log('\n=== Calculator tests (TC-5) ===\n');

// AC-1: add
assert('add(2, 3) === 5', add(2, 3), 5);
assert('add(-1, 1) === 0', add(-1, 1), 0);
assert('add(0.1, 0.2) ≈ 0.3', add(0.1, 0.2), 0.30000000000000004); // JS float behaviour

// AC-2: subtract
assert('subtract(5, 3) === 2', subtract(5, 3), 2);
assert('subtract(0, 0) === 0', subtract(0, 0), 0);

// AC-3: multiply
assert('multiply(3, 4) === 12', multiply(3, 4), 12);
assert('multiply(-2, 5) === -10', multiply(-2, 5), -10);
assert('multiply(0, 99) === 0', multiply(0, 99), 0);

// AC-4: divide
assert('divide(10, 2) === 5', divide(10, 2), 5);
assert('divide(7, 2) === 3.5', divide(7, 2), 3.5);

// AC-5: divide by zero
assertThrows('divide(1, 0) throws', () => divide(1, 0), 'Division by zero');

// AC-6: sin
assert('sin(0) === 0', sin(0), 0);
assert('sin(Math.PI / 2) ≈ 1', sin(Math.PI / 2), 1);
assert('sin(Math.PI) ≈ 0', sin(Math.PI), Math.sin(Math.PI));

console.log(`\n${failures === 0 ? '✅ All tests passed.' : `❌ ${String(failures)} test(s) failed.`}\n`);

if (failures > 0) {
  process.exit(1);
}
