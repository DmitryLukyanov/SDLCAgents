import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, calculate } from '../../../src/calculator/calculator.js';
import { formatNumber } from '../../../src/calculator/formatter.js';
import { Operation } from '../../../src/calculator/types.js';
import type { BinaryExpression, UnaryExpression } from '../../../src/calculator/types.js';

// ── US1: Binary operations ────────────────────────────────────────────────────

describe('calculator — binary operations (US1)', () => {
  it('adds two numbers', () => {
    const expr: BinaryExpression = { kind: 'binary', operator: Operation.Add, left: 5, right: 3 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 8);
  });

  it('subtracts two numbers', () => {
    const expr: BinaryExpression = { kind: 'binary', operator: Operation.Subtract, left: 10, right: 4 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 6);
  });

  it('multiplies two numbers', () => {
    const expr: BinaryExpression = { kind: 'binary', operator: Operation.Multiply, left: 6, right: 7 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 42);
  });

  it('divides two numbers', () => {
    const expr: BinaryExpression = { kind: 'binary', operator: Operation.Divide, left: 15, right: 3 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 5);
  });

  it('returns ErrorResult for division by zero', () => {
    const expr: BinaryExpression = { kind: 'binary', operator: Operation.Divide, left: 7, right: 0 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'error');
    assert.equal((result as { message: string }).message, 'Division by zero is not allowed.');
  });
});

// ── US2: Sine operation ───────────────────────────────────────────────────────

describe('calculator — sin() operation (US2)', () => {
  it('sin(0) returns 0', () => {
    const expr: UnaryExpression = { kind: 'unary', operator: Operation.Sin, operand: 0 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 0);
  });

  it('sin(30) returns ~0.5', () => {
    const expr: UnaryExpression = { kind: 'unary', operator: Operation.Sin, operand: 30 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    // Within floating-point precision
    assert.ok(Math.abs((result as { value: number }).value - 0.5) < 1e-10);
  });

  it('sin(90) returns 1', () => {
    const expr: UnaryExpression = { kind: 'unary', operator: Operation.Sin, operand: 90 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.ok(Math.abs((result as { value: number }).value - 1) < 1e-10);
  });

  it('sin(-90) returns -1', () => {
    const expr: UnaryExpression = { kind: 'unary', operator: Operation.Sin, operand: -90 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    assert.ok(Math.abs((result as { value: number }).value - (-1)) < 1e-10);
  });

  it('sin(30) formatted output strips trailing zeros', () => {
    const expr: UnaryExpression = { kind: 'unary', operator: Operation.Sin, operand: 30 };
    const result = evaluate(expr);
    assert.equal(result.kind, 'success');
    const formatted = formatNumber((result as { value: number }).value);
    assert.equal(formatted, '0.5');
  });
});

// ── US3: Overflow / NaN paths ─────────────────────────────────────────────────

describe('calculator — overflow and NaN (US3)', () => {
  it('very large number multiplication producing Infinity returns ErrorResult', () => {
    const expr: BinaryExpression = {
      kind: 'binary',
      operator: Operation.Multiply,
      left: Number.MAX_VALUE,
      right: 2,
    };
    const result = evaluate(expr);
    assert.equal(result.kind, 'error');
    assert.equal((result as { message: string }).message, 'Result is out of numeric range.');
  });

  it('calculate facade returns ErrorResult for parse failure', () => {
    const result = calculate('');
    assert.equal(result.kind, 'error');
    assert.equal((result as { message: string }).message, 'Please enter a valid expression.');
  });

  it('calculate facade returns SuccessResult for valid expression', () => {
    const result = calculate('5 + 3');
    assert.equal(result.kind, 'success');
    assert.equal((result as { value: number }).value, 8);
  });
});
