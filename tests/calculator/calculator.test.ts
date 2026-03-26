/**
 * Tests for the simple calculator library.
 *
 * Run: tsx tests/calculator/calculator.test.ts
 */
import { add, subtract, multiply, divide, sin } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(description: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    console.error(`     expected: ${String(expected)}`);
    console.error(`     actual:   ${String(actual)}`);
    failed++;
  }
}

function assertClose(description: string, actual: number, expected: number, tolerance = 1e-10): void {
  if (Math.abs(actual - expected) <= tolerance) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    console.error(`     expected: ${expected} (±${tolerance})`);
    console.error(`     actual:   ${actual}`);
    failed++;
  }
}

function assertThrows(description: string, fn: () => unknown, messageSubstring?: string): void {
  try {
    fn();
    console.error(`  ❌ ${description} — expected an error but none was thrown`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (messageSubstring && !msg.toLowerCase().includes(messageSubstring.toLowerCase())) {
      console.error(`  ❌ ${description} — error thrown but message did not contain "${messageSubstring}": "${msg}"`);
      failed++;
    } else {
      console.log(`  ✅ ${description}`);
      passed++;
    }
  }
}

console.log('\n=== Calculator tests ===\n');

console.log('add:');
assert('add(2, 3) === 5', add(2, 3), 5);
assert('add(-1, 1) === 0', add(-1, 1), 0);
assert('add(0, 0) === 0', add(0, 0), 0);

console.log('\nsubtract:');
assert('subtract(10, 4) === 6', subtract(10, 4), 6);
assert('subtract(0, 5) === -5', subtract(0, 5), -5);

console.log('\nmultiply:');
assert('multiply(3, 7) === 21', multiply(3, 7), 21);
assert('multiply(-2, 4) === -8', multiply(-2, 4), -8);
assert('multiply(0, 999) === 0', multiply(0, 999), 0);

console.log('\ndivide:');
assert('divide(10, 2) === 5', divide(10, 2), 5);
assert('divide(9, 3) === 3', divide(9, 3), 3);
assertThrows('divide(5, 0) throws', () => divide(5, 0), 'zero');

console.log('\nsin:');
assert('sin(0) === 0', sin(0), 0);
assertClose('sin(Math.PI / 2) ≈ 1', sin(Math.PI / 2), 1);
assertClose('sin(Math.PI) ≈ 0', sin(Math.PI), 0);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
