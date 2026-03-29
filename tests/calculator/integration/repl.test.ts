/**
 * Integration tests: full parse → evaluate → format pipeline.
 * Imports from src/calculator/index.ts — does NOT spin up readline.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, formatNumber } from '../../../src/calculator/index.js';

// Helper: run the full pipeline and return the display string
function run(expression: string): string {
  const result = calculate(expression);
  if (result.kind === 'success') {
    return formatNumber(result.value);
  }
  return result.message;
}

// ── US1: Basic arithmetic (Phase 3) ──────────────────────────────────────────

describe('integration — basic arithmetic (US1)', () => {
  it('5 + 3 → "8"', () => {
    assert.equal(run('5 + 3'), '8');
  });

  it('10 - 4 → "6"', () => {
    assert.equal(run('10 - 4'), '6');
  });

  it('6 * 7 → "42"', () => {
    assert.equal(run('6 * 7'), '42');
  });

  it('15 / 3 → "5"', () => {
    assert.equal(run('15 / 3'), '5');
  });

  it('1 / 3 → "0.3333333333"', () => {
    assert.equal(run('1 / 3'), '0.3333333333');
  });

  it('7 / 0 → division by zero error', () => {
    assert.equal(run('7 / 0'), 'Division by zero is not allowed.');
  });
});

// ── US2: Sine operation (Phase 4) ─────────────────────────────────────────────

describe('integration — sin() operation (US2)', () => {
  it('sin(0) → "0"', () => {
    assert.equal(run('sin(0)'), '0');
  });

  it('sin(30) → "0.5"', () => {
    assert.equal(run('sin(30)'), '0.5');
  });

  it('sin(90) → "1"', () => {
    assert.equal(run('sin(90)'), '1');
  });

  it('sin(-90) → "-1"', () => {
    assert.equal(run('sin(-90)'), '-1');
  });
});

// ── US3: Error scenarios (Phase 5) ───────────────────────────────────────────

describe('integration — error handling (US3)', () => {
  it('blank input → "Please enter a valid expression."', () => {
    assert.equal(run(''), 'Please enter a valid expression.');
  });

  it('cos(30) → unsupported operation message', () => {
    assert.equal(run('cos(30)'), 'Unsupported operation. Supported: +, -, *, /, sin.');
  });

  it('"5 +" → incomplete expression message', () => {
    assert.equal(run('5 +'), 'Incomplete expression. Expected: <number> <+|-|*|/> <number>.');
  });

  it('"abc" → invalid expression message', () => {
    assert.equal(run('abc'), 'Invalid expression. Try: 5 + 3 or sin(30).');
  });

  it('"1 + 2 + 3" → invalid expression message', () => {
    assert.equal(run('1 + 2 + 3'), 'Invalid expression. Try: 5 + 3 or sin(30).');
  });
});
