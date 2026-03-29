import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { sin } from '../../src/lib/calculator.js';
import * as calculator from '../../src/lib/calculator.js';

// ---------------------------------------------------------------------------
// sin — basic values
// ---------------------------------------------------------------------------

test('sin(0) equals 0', () => {
  assert.strictEqual(sin(0), 0);
});

test('sin(π/2) is within float64 precision of 1', () => {
  assert.ok(Math.abs(sin(Math.PI / 2) - 1) < 1e-10);
});

test('sin(π/6) is within float64 precision of 0.5', () => {
  assert.ok(Math.abs(sin(Math.PI / 6) - 0.5) < 1e-10);
});

// ---------------------------------------------------------------------------
// sin — IEEE 754 edge cases delegated to Math.sin
// ---------------------------------------------------------------------------

test('sin(Infinity) returns NaN (IEEE 754 delegation)', () => {
  assert.ok(Number.isNaN(sin(Infinity)));
});

// ---------------------------------------------------------------------------
// Input validation — TypeError on invalid arguments
// ---------------------------------------------------------------------------

test('sin: string argument throws TypeError with "must be a valid number"', () => {
  assert.throws(
    () => sin('π/2' as unknown as number),
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a valid number/);
      return true;
    },
  );
});

test('sin: NaN argument throws TypeError with "must be a valid number"', () => {
  assert.throws(
    () => sin(NaN),
    (err: unknown) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a valid number/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Banned exports: cos, tan, cot must NOT be exported
// ---------------------------------------------------------------------------

test('calculator module does NOT export cos', () => {
  assert.strictEqual((calculator as Record<string, unknown>)['cos'], undefined);
});

test('calculator module does NOT export tan', () => {
  assert.strictEqual((calculator as Record<string, unknown>)['tan'], undefined);
});

test('calculator module does NOT export cot', () => {
  assert.strictEqual((calculator as Record<string, unknown>)['cot'], undefined);
});
