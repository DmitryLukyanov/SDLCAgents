/**
 * Unit tests for the Simple Calculator library (TC-5)
 * Run: node --test tests/calculator/calculator.test.ts
 * (tsx or ts-node not required; Node 20 can run .ts via the --experimental-strip-types flag,
 *  or use: npx tsx --test tests/calculator/calculator.test.ts)
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { add, subtract, multiply, divide, sin, CalculatorError } from '../../src/calculator/calculator.js';

describe('Calculator – add', () => {
  it('adds two positive numbers', () => {
    assert.equal(add(2, 3), 5);
  });

  it('adds a positive and a negative number', () => {
    assert.equal(add(10, -4), 6);
  });

  it('adds two negative numbers', () => {
    assert.equal(add(-3, -7), -10);
  });

  it('adds zeros', () => {
    assert.equal(add(0, 0), 0);
  });
});

describe('Calculator – subtract', () => {
  it('subtracts smaller from larger', () => {
    assert.equal(subtract(9, 4), 5);
  });

  it('subtracts to produce a negative result', () => {
    assert.equal(subtract(3, 8), -5);
  });

  it('subtracts zero', () => {
    assert.equal(subtract(7, 0), 7);
  });
});

describe('Calculator – multiply', () => {
  it('multiplies two positive numbers', () => {
    assert.equal(multiply(3, 4), 12);
  });

  it('multiplies by zero', () => {
    assert.equal(multiply(5, 0), 0);
  });

  it('multiplies two negative numbers', () => {
    assert.equal(multiply(-3, -2), 6);
  });

  it('multiplies positive and negative', () => {
    assert.equal(multiply(4, -3), -12);
  });
});

describe('Calculator – divide', () => {
  it('divides evenly', () => {
    assert.equal(divide(10, 2), 5);
  });

  it('divides producing a decimal', () => {
    assert.equal(divide(1, 4), 0.25);
  });

  it('divides a negative number', () => {
    assert.equal(divide(-9, 3), -3);
  });

  it('throws CalculatorError when dividing by zero', () => {
    assert.throws(
      () => divide(5, 0),
      (err: unknown) => {
        assert.ok(err instanceof CalculatorError, 'error should be CalculatorError');
        assert.ok((err as CalculatorError).message.length > 0);
        return true;
      },
    );
  });
});

describe('Calculator – sin', () => {
  const EPSILON = 1e-10;

  it('sin(0) equals 0', () => {
    assert.equal(sin(0), 0);
  });

  it('sin(π/2) is approximately 1', () => {
    assert.ok(Math.abs(sin(Math.PI / 2) - 1) < EPSILON);
  });

  it('sin(π) is approximately 0', () => {
    assert.ok(Math.abs(sin(Math.PI)) < EPSILON);
  });

  it('sin(-π/2) is approximately -1', () => {
    assert.ok(Math.abs(sin(-Math.PI / 2) - (-1)) < EPSILON);
  });
});
