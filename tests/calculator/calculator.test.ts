/**
 * Self-contained calculator test script.
 * Run: npm run calculator:test
 */
import { add, subtract, multiply, divide, sin } from '../../src/calculator/calculator.js';

let passed = 0;
let failed = 0;

function assert(description: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${description}`);
    passed++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL  ${description} — ${message}`);
    failed++;
  }
}

function assertEqual(actual: number, expected: number, tolerance = 0): void {
  if (tolerance > 0) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${expected} ± ${tolerance}, got ${actual}`);
    }
  } else {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  }
}

function assertThrows(fn: () => unknown, messageFragment?: string): void {
  try {
    fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (err) {
    if (err instanceof Error && err.message === 'Expected function to throw, but it did not') {
      throw err;
    }
    if (messageFragment !== undefined) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes(messageFragment)) {
        throw new Error(`Expected error containing "${messageFragment}", got "${message}"`);
      }
    }
  }
}

// ── add ──────────────────────────────────────────────────────────────────────
console.log('\nadd');
assert('add(2, 3) === 5', () => assertEqual(add(2, 3), 5));
assert('add(-1, 1) === 0', () => assertEqual(add(-1, 1), 0));
assert('add(0, 0) === 0', () => assertEqual(add(0, 0), 0));
assert('add(1.5, 2.5) === 4', () => assertEqual(add(1.5, 2.5), 4));
assert('add(NaN, 1) throws', () => assertThrows(() => add(NaN, 1), 'NaN'));
assert('add(Infinity, 1) throws', () => assertThrows(() => add(Infinity, 1), 'finite'));
assert('add("x" as any, 1) throws', () => assertThrows(() => add('x' as unknown as number, 1), 'number'));

// ── subtract ─────────────────────────────────────────────────────────────────
console.log('\nsubtract');
assert('subtract(5, 3) === 2', () => assertEqual(subtract(5, 3), 2));
assert('subtract(0, 5) === -5', () => assertEqual(subtract(0, 5), -5));
assert('subtract(1.1, 0.1) ≈ 1', () => assertEqual(subtract(1.1, 0.1), 1, 1e-10));
assert('subtract(NaN, 1) throws', () => assertThrows(() => subtract(NaN, 1), 'NaN'));
assert('subtract(1, Infinity) throws', () => assertThrows(() => subtract(1, Infinity), 'finite'));

// ── multiply ─────────────────────────────────────────────────────────────────
console.log('\nmultiply');
assert('multiply(3, 4) === 12', () => assertEqual(multiply(3, 4), 12));
assert('multiply(-2, 5) === -10', () => assertEqual(multiply(-2, 5), -10));
assert('multiply(0, 999) === 0', () => assertEqual(multiply(0, 999), 0));
assert('multiply(NaN, 2) throws', () => assertThrows(() => multiply(NaN, 2), 'NaN'));
assert('multiply(2, -Infinity) throws', () => assertThrows(() => multiply(2, -Infinity), 'finite'));

// ── divide ───────────────────────────────────────────────────────────────────
console.log('\ndivide');
assert('divide(10, 2) === 5', () => assertEqual(divide(10, 2), 5));
assert('divide(7, 2) === 3.5', () => assertEqual(divide(7, 2), 3.5));
assert('divide(-9, 3) === -3', () => assertEqual(divide(-9, 3), -3));
assert('divide(0, 5) === 0', () => assertEqual(divide(0, 5), 0));
assert('divide(1, 0) throws (division by zero)', () => assertThrows(() => divide(1, 0), 'zero'));
assert('divide(NaN, 2) throws', () => assertThrows(() => divide(NaN, 2), 'NaN'));
assert('divide(2, Infinity) throws', () => assertThrows(() => divide(2, Infinity), 'finite'));

// ── sin ──────────────────────────────────────────────────────────────────────
const PI = Math.PI;
console.log('\nsin');
assert('sin(0) === 0', () => assertEqual(sin(0), 0, 1e-10));
assert('sin(π/6) ≈ 0.5', () => assertEqual(sin(PI / 6), 0.5, 1e-10));
assert('sin(π/2) ≈ 1', () => assertEqual(sin(PI / 2), 1, 1e-10));
assert('sin(π) ≈ 0', () => assertEqual(sin(PI), 0, 1e-10));
assert('sin(3π/2) ≈ -1', () => assertEqual(sin((3 * PI) / 2), -1, 1e-10));
assert('sin(2π) ≈ 0', () => assertEqual(sin(2 * PI), 0, 1e-10));
assert('sin(NaN) throws', () => assertThrows(() => sin(NaN), 'NaN'));
assert('sin(Infinity) throws', () => assertThrows(() => sin(Infinity), 'finite'));
assert('sin("x" as any) throws', () => assertThrows(() => sin('x' as unknown as number), 'number'));

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Total: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
