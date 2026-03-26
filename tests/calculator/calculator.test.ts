import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  add,
  subtract,
  multiply,
  divide,
  sin,
  CalculatorError,
} from '../../src/calculator/calculator.js';

// ---------------------------------------------------------------------------
// US1 — Basic Arithmetic Operations
// ---------------------------------------------------------------------------

describe('add', () => {
  it('adds two positive numbers', () => assert.equal(add(2, 3), 5));
  it('adds two negative numbers', () => assert.equal(add(-1, -1), -2));
  it('adds zeros', () => assert.equal(add(0, 0), 0));
});

describe('subtract', () => {
  it('subtracts smaller from larger', () => assert.equal(subtract(5, 3), 2));
  it('subtracts larger from smaller (negative result)', () =>
    assert.equal(subtract(3, 5), -2));
});

describe('multiply', () => {
  it('multiplies two positive numbers', () => assert.equal(multiply(3, 4), 12));
  it('multiplies by zero', () => assert.equal(multiply(5, 0), 0));
});

describe('divide', () => {
  it('divides evenly', () => assert.equal(divide(9, 3), 3));
  it('divides with a decimal result', () => assert.equal(divide(10, 4), 2.5));
});

// ---------------------------------------------------------------------------
// US2 — Division by Zero Protection
// ---------------------------------------------------------------------------

describe('divide — division by zero', () => {
  it('throws CalculatorError when divisor is 0', () => {
    assert.throws(() => divide(5, 0), (err: unknown) => {
      assert.ok(err instanceof CalculatorError, 'should be CalculatorError');
      assert.match((err as CalculatorError).message, /division by zero/i);
      return true;
    });
  });

  it('throws CalculatorError for 0 ÷ 0', () => {
    assert.throws(() => divide(0, 0), CalculatorError);
  });

  it('throws CalculatorError for negative ÷ 0', () => {
    assert.throws(() => divide(-1, 0), CalculatorError);
  });
});

describe('arithmetic — non-finite inputs', () => {
  it('add throws for Infinity', () =>
    assert.throws(() => add(Infinity, 1), CalculatorError));
  it('subtract throws for NaN', () =>
    assert.throws(() => subtract(NaN, 2), CalculatorError));
  it('multiply throws for NaN second arg', () =>
    assert.throws(() => multiply(1, NaN), CalculatorError));
  it('divide throws for Infinity first arg', () =>
    assert.throws(() => divide(Infinity, 2), CalculatorError));
});

// ---------------------------------------------------------------------------
// US3 — Sine Trigonometric Function
// ---------------------------------------------------------------------------

describe('sin', () => {
  it('sin(0) === 0', () => assert.equal(sin(0), 0));
  it('sin(π/2) ≈ 1', () =>
    assert.ok(Math.abs(sin(Math.PI / 2) - 1) < 1e-10));
  it('sin(π) ≈ 0', () =>
    assert.ok(Math.abs(sin(Math.PI)) < 1e-10));
  it('sin(-π/2) ≈ -1', () =>
    assert.ok(Math.abs(sin(-Math.PI / 2) + 1) < 1e-10));
  it('sin(1e9) is within [-1, 1]', () => {
    const result = sin(1e9);
    assert.ok(result >= -1 && result <= 1);
  });
});

describe('sin — invalid inputs', () => {
  it('throws CalculatorError for Infinity', () =>
    assert.throws(() => sin(Infinity), CalculatorError));
  it('throws CalculatorError for -Infinity', () =>
    assert.throws(() => sin(-Infinity), CalculatorError));
  it('throws CalculatorError for NaN', () =>
    assert.throws(() => sin(NaN), CalculatorError));
});
