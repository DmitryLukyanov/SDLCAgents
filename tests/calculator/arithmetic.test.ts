import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { add, subtract, multiply, divide } from '../../src/lib/calculator.js';

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

test('add: 8 + 5 equals 13', () => {
  assert.strictEqual(add(8, 5), 13);
});

test('add: 0.1 + 0.2 returns IEEE 754 float64 result', () => {
  // JavaScript float64 result — not exactly 0.3
  assert.strictEqual(add(0.1, 0.2), 0.1 + 0.2);
});

test('add: Infinity + 1 equals Infinity', () => {
  assert.strictEqual(add(Infinity, 1), Infinity);
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------

test('subtract: 10 - 4 equals 6', () => {
  assert.strictEqual(subtract(10, 4), 6);
});

test('subtract: 0 - 5 equals -5', () => {
  assert.strictEqual(subtract(0, 5), -5);
});

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------

test('multiply: 6 * 7 equals 42', () => {
  assert.strictEqual(multiply(6, 7), 42);
});

test('multiply: -3 * 4 equals -12', () => {
  assert.strictEqual(multiply(-3, 4), -12);
});

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------

test('divide: 15 / 4 equals 3.75', () => {
  assert.strictEqual(divide(15, 4), 3.75);
});

test('divide: 0 / 5 equals 0', () => {
  assert.strictEqual(divide(0, 5), 0);
});

test('divide: 9 / 0 throws Error with "Division by zero"', () => {
  assert.throws(
    () => divide(9, 0),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Division by zero/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Input validation — TypeError on invalid arguments
// ---------------------------------------------------------------------------

test('add: NaN as first argument throws TypeError with "must be a valid number"', () => {
  assert.throws(
    () => add(NaN, 5),
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a valid number/);
      return true;
    },
  );
});

test('add: string as first argument throws TypeError with "must be a valid number"', () => {
  assert.throws(
    () => add('8' as unknown as number, 5),
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a valid number/);
      return true;
    },
  );
});

test('divide: NaN as second argument throws TypeError with "must be a valid number"', () => {
  assert.throws(
    () => divide(9, NaN),
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a valid number/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// SC-006: Post-error isolation — after a throw, subsequent calls still work
// ---------------------------------------------------------------------------

test('SC-006: add(1,1) succeeds after divide(9,0) threw', () => {
  assert.throws(() => divide(9, 0));
  assert.strictEqual(add(1, 1), 2);
});
