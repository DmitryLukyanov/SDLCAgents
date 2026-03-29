// T006 + T011: Parser/evaluator unit tests (arithmetic + sin)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../../src/calculator/parser.js';
import { format } from '../../src/calculator/formatter.js';

describe('Parser/Evaluator — Basic Arithmetic (US1)', () => {
  it('10 + 5 = 15', () => {
    assert.equal(evaluate('10 + 5'), 15);
  });

  it('8 - 3 = 5', () => {
    assert.equal(evaluate('8 - 3'), 5);
  });

  it('6 * 7 = 42', () => {
    assert.equal(evaluate('6 * 7'), 42);
  });

  it('20 / 4 = 5', () => {
    assert.equal(evaluate('20 / 4'), 5);
  });

  it('5 / 0 throws Division by zero', () => {
    assert.throws(() => evaluate('5 / 0'), /Division by zero/);
  });

  it('2 + 3 * 4 = 14 (operator precedence)', () => {
    assert.equal(evaluate('2 + 3 * 4'), 14);
  });

  it('(2 + 3) * 4 = 20 (parentheses override precedence)', () => {
    assert.equal(evaluate('(2 + 3) * 4'), 20);
  });

  it('-5 + 3 = -2 (unary minus)', () => {
    assert.equal(evaluate('-5 + 3'), -2);
  });

  it('3 * -2 = -6 (unary minus in sub-expression)', () => {
    assert.equal(evaluate('3 * -2'), -6);
  });

  it('1 / 3 formats to "0.3333333333" (formatter integration)', () => {
    assert.equal(format(evaluate('1 / 3')), '0.3333333333');
  });

  describe('error cases', () => {
    it('throws Unknown function for unknown identifier', () => {
      assert.throws(() => evaluate('foo(1)'), /Unknown function 'foo'/);
    });

    it('throws Expected ) for missing closing paren', () => {
      assert.throws(() => evaluate('(2 + 3'), /Expected '\)'/);
    });

    it('throws Unexpected token for trailing garbage', () => {
      assert.throws(() => evaluate('2 + 3 4'), /Unexpected token '4'/);
    });

    it('throws Unexpected token for bare operator', () => {
      assert.throws(() => evaluate('+'), /Unexpected token/);
    });
  });
});

describe('Parser/Evaluator — Sine Function (US2)', () => {
  it('sin(0) = 0', () => {
    assert.equal(evaluate('sin(0)'), 0);
  });

  it('sin(90) = 1', () => {
    // sin(90°) = 1 exactly in IEEE 754 with this formula
    assert.ok(Math.abs(evaluate('sin(90)') - 1) < 1e-10);
  });

  it('sin(30) = 0.5', () => {
    assert.ok(Math.abs(evaluate('sin(30)') - 0.5) < 1e-10);
  });

  it('sin(180) is within ±0.0001 of 0 (floating-point artefact)', () => {
    const result = evaluate('sin(180)');
    assert.ok(Math.abs(result) < 0.0001, `Expected near 0, got ${result}`);
  });

  it('10 + sin(30) * 2 = 11 (embedded in larger expression)', () => {
    const result = evaluate('10 + sin(30) * 2');
    assert.ok(Math.abs(result - 11) < 1e-10, `Expected 11, got ${result}`);
  });

  it('cos(45) throws Unknown function', () => {
    assert.throws(() => evaluate('cos(45)'), /Unknown function 'cos'/);
  });
});

describe('Formatter', () => {
  it('formats 42 as "42" (no decimal)', () => {
    assert.equal(format(42), '42');
  });

  it('formats 1/3 as "0.3333333333"', () => {
    assert.equal(format(1 / 3), '0.3333333333');
  });

  it('formats Infinity as "Infinity"', () => {
    assert.equal(format(Infinity), 'Infinity');
  });

  it('formats -Infinity as "-Infinity"', () => {
    assert.equal(format(-Infinity), '-Infinity');
  });

  it('formats NaN as "NaN"', () => {
    assert.equal(format(NaN), 'NaN');
  });

  it('formats 0 as "0"', () => {
    assert.equal(format(0), '0');
  });
});
