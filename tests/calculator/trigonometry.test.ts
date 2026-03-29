import { describe, test } from 'node:test';
import assert from 'node:assert';
import { sin } from '../../src/calculator/trigonometry.js';

describe('sin', () => {
  test('sin(0) equals 0', () => {
    assert.strictEqual(sin(0), 0);
  });

  test('sin(π/2) equals 1', () => {
    assert.ok(Math.abs(sin(Math.PI / 2) - 1) < Number.EPSILON);
  });

  test('sin(π) is approximately 0', () => {
    assert.ok(Math.abs(sin(Math.PI)) < 1e-15);
  });

  test('sin(-π/2) equals -1', () => {
    assert.ok(Math.abs(sin(-Math.PI / 2) - (-1)) < Number.EPSILON);
  });

  test('sin(2π) is approximately 0', () => {
    assert.ok(Math.abs(sin(2 * Math.PI)) < 1e-15);
  });

  test('sin(Infinity) returns NaN (IEEE 754)', () => {
    assert.ok(Number.isNaN(sin(Infinity)));
  });

  test('sin(-Infinity) returns NaN (IEEE 754)', () => {
    assert.ok(Number.isNaN(sin(-Infinity)));
  });

  test('sin(NaN) returns NaN', () => {
    assert.ok(Number.isNaN(sin(NaN)));
  });

  test('throws TypeError when argument is not a number', () => {
    assert.throws(
      () => sin('0' as unknown as number),
      TypeError,
    );
  });

  test('throws TypeError when argument is null', () => {
    assert.throws(
      () => sin(null as unknown as number),
      TypeError,
    );
  });
});
