import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../../src/calculator/parser.js';
import type { BinaryExpression } from '../../../src/calculator/types.js';
import { Operation } from '../../../src/calculator/types.js';

// ── US1: Binary expression happy paths ───────────────────────────────────────

describe('parser — binary expressions (US1)', () => {
  it('parses integer addition', () => {
    const result = parse('5 + 3');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.operator, Operation.Add);
    assert.equal(expr.left, 5);
    assert.equal(expr.right, 3);
  });

  it('parses integer subtraction', () => {
    const result = parse('10 - 4');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.operator, Operation.Subtract);
    assert.equal(expr.left, 10);
    assert.equal(expr.right, 4);
  });

  it('parses integer multiplication', () => {
    const result = parse('6 * 7');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.operator, Operation.Multiply);
    assert.equal(expr.left, 6);
    assert.equal(expr.right, 7);
  });

  it('parses integer division', () => {
    const result = parse('15 / 3');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.operator, Operation.Divide);
    assert.equal(expr.left, 15);
    assert.equal(expr.right, 3);
  });

  it('parses decimal operands', () => {
    const result = parse('1.5 + 2.5');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.left, 1.5);
    assert.equal(expr.right, 2.5);
  });

  it('parses negative left operand', () => {
    const result = parse('-3.5 * 2');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.left, -3.5);
    assert.equal(expr.right, 2);
  });

  it('parses negative right operand', () => {
    const result = parse('10 - -4');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.left, 10);
    assert.equal(expr.right, -4);
  });

  it('trims surrounding whitespace', () => {
    const result = parse('  5 + 3  ');
    assert.equal(result.kind, 'binary');
  });

  it('handles no whitespace around operator', () => {
    const result = parse('10-4');
    assert.equal(result.kind, 'binary');
    const expr = result as BinaryExpression;
    assert.equal(expr.left, 10);
    assert.equal(expr.right, 4);
  });
});

// ── US2: sin() parsing ────────────────────────────────────────────────────────

describe('parser — sin() expressions (US2)', () => {
  it('parses sin(0)', () => {
    const result = parse('sin(0)');
    assert.equal(result.kind, 'unary');
  });

  it('parses sin(30)', () => {
    const result = parse('sin(30)');
    assert.equal(result.kind, 'unary');
  });

  it('parses sin(-90)', () => {
    const result = parse('sin(-90)');
    assert.equal(result.kind, 'unary');
    assert.equal((result as { operand: number }).operand, -90);
  });

  it('parses sin() with inner whitespace', () => {
    const result = parse('sin( 30 )');
    assert.equal(result.kind, 'unary');
  });

  it('rejects sin without parentheses', () => {
    const result = parse('sin 30');
    assert.equal(result.kind, 'parse-error');
  });

  it('parses sin case-insensitively', () => {
    const result = parse('SIN(30)');
    assert.equal(result.kind, 'unary');
  });
});

// ── US3: ParseError messages ──────────────────────────────────────────────────

describe('parser — error messages (US3)', () => {
  it('blank input returns "Please enter a valid expression."', () => {
    const result = parse('');
    assert.equal(result.kind, 'parse-error');
    assert.equal((result as { message: string }).message, 'Please enter a valid expression.');
  });

  it('whitespace-only input returns "Please enter a valid expression."', () => {
    const result = parse('   ');
    assert.equal(result.kind, 'parse-error');
    assert.equal((result as { message: string }).message, 'Please enter a valid expression.');
  });

  it('unsupported function returns correct message', () => {
    const result = parse('cos(30)');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Unsupported operation. Supported: +, -, *, /, sin.',
    );
  });

  it('percent operator returns unsupported operation message', () => {
    const result = parse('5 % 3');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Unsupported operation. Supported: +, -, *, /, sin.',
    );
  });

  it('caret operator returns unsupported operation message', () => {
    const result = parse('5 ^ 3');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Unsupported operation. Supported: +, -, *, /, sin.',
    );
  });

  it('incomplete binary "5 +" returns correct message', () => {
    const result = parse('5 +');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Incomplete expression. Expected: <number> <+|-|*|/> <number>.',
    );
  });

  it('incomplete binary "* 3" returns correct message', () => {
    const result = parse('* 3');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Incomplete expression. Expected: <number> <+|-|*|/> <number>.',
    );
  });

  it('unrecognised pattern "abc" returns correct message', () => {
    const result = parse('abc');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Invalid expression. Try: 5 + 3 or sin(30).',
    );
  });

  it('chained expression "1 + 2 + 3" returns correct message', () => {
    const result = parse('1 + 2 + 3');
    assert.equal(result.kind, 'parse-error');
    assert.equal(
      (result as { message: string }).message,
      'Invalid expression. Try: 5 + 3 or sin(30).',
    );
  });
});
