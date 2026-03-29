import { describe, test } from 'node:test';
import assert from 'node:assert';
import { add, subtract, multiply, divide } from '../../src/calculator/arithmetic.js';

describe('add', () => {
  test('adds two positive numbers', () => {
    assert.strictEqual(add(2, 3), 5);
  });

  test('adds a positive and a negative number', () => {
    assert.strictEqual(add(10, -4), 6);
  });

  test('adds two negative numbers', () => {
    assert.strictEqual(add(-1, -2), -3);
  });

  test('adds zero to a number', () => {
    assert.strictEqual(add(5, 0), 5);
  });

  test('adds floating-point numbers', () => {
    assert.ok(Math.abs(add(0.1, 0.2) - 0.3) < Number.EPSILON);
  });

  test('throws TypeError when first argument is not a number', () => {
    assert.throws(
      () => add('a' as unknown as number, 1),
      TypeError,
    );
  });

  test('throws TypeError when second argument is not a number', () => {
    assert.throws(
      () => add(1, null as unknown as number),
      TypeError,
    );
  });
});

describe('subtract', () => {
  test('subtracts two positive numbers', () => {
    assert.strictEqual(subtract(10, 4), 6);
  });

  test('subtracts a larger from a smaller number', () => {
    assert.strictEqual(subtract(3, 7), -4);
  });

  test('subtracts zero', () => {
    assert.strictEqual(subtract(5, 0), 5);
  });

  test('subtracts a negative number', () => {
    assert.strictEqual(subtract(5, -3), 8);
  });

  test('throws TypeError when first argument is not a number', () => {
    assert.throws(
      () => subtract(undefined as unknown as number, 1),
      TypeError,
    );
  });

  test('throws TypeError when second argument is not a number', () => {
    assert.throws(
      () => subtract(1, '2' as unknown as number),
      TypeError,
    );
  });
});

describe('multiply', () => {
  test('multiplies two positive numbers', () => {
    assert.strictEqual(multiply(3, 4), 12);
  });

  test('multiplies a positive and a negative number', () => {
    assert.strictEqual(multiply(5, -2), -10);
  });

  test('multiplies two negative numbers', () => {
    assert.strictEqual(multiply(-3, -4), 12);
  });

  test('multiplies by zero', () => {
    assert.strictEqual(multiply(99, 0), 0);
  });

  test('multiplies by one (identity)', () => {
    assert.strictEqual(multiply(7, 1), 7);
  });

  test('throws TypeError when first argument is not a number', () => {
    assert.throws(
      () => multiply([] as unknown as number, 2),
      TypeError,
    );
  });

  test('throws TypeError when second argument is not a number', () => {
    assert.throws(
      () => multiply(2, {} as unknown as number),
      TypeError,
    );
  });
});

describe('divide', () => {
  test('divides two positive numbers', () => {
    assert.strictEqual(divide(10, 2), 5);
  });

  test('divides a negative by a positive number', () => {
    assert.strictEqual(divide(-9, 3), -3);
  });

  test('divides and returns a fractional result', () => {
    assert.strictEqual(divide(1, 4), 0.25);
  });

  test('divides by one (identity)', () => {
    assert.strictEqual(divide(7, 1), 7);
  });

  test('throws Error on division by zero', () => {
    assert.throws(
      () => divide(5, 0),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Division by zero');
        return true;
      },
    );
  });

  test('throws TypeError when first argument is not a number', () => {
    assert.throws(
      () => divide('10' as unknown as number, 2),
      TypeError,
    );
  });

  test('throws TypeError when second argument is not a number', () => {
    assert.throws(
      () => divide(10, false as unknown as number),
      TypeError,
    );
  });
});
