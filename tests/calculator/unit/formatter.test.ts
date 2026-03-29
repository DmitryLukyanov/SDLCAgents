import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber } from '../../../src/calculator/formatter.js';

// ── US1: Number formatting ────────────────────────────────────────────────────

describe('formatter — formatNumber (US1)', () => {
  it('formats integer result without decimal point', () => {
    assert.equal(formatNumber(8), '8');
  });

  it('formats decimal with trailing zeros stripped', () => {
    assert.equal(formatNumber(0.5), '0.5');
  });

  it('formats 1/3 to 10 significant digits', () => {
    assert.equal(formatNumber(1 / 3), '0.3333333333');
  });

  it('formats -1 correctly', () => {
    assert.equal(formatNumber(-1), '-1');
  });

  it('formats Math.PI to 10 significant digits', () => {
    assert.equal(formatNumber(Math.PI), '3.141592654');
  });

  it('formats zero as "0"', () => {
    assert.equal(formatNumber(0), '0');
  });
});

// ── US3: Edge cases — Infinity / NaN ─────────────────────────────────────────

describe('formatter — Infinity and NaN edge cases (US3)', () => {
  it('Infinity returns "Result is out of numeric range."', () => {
    assert.equal(formatNumber(Infinity), 'Result is out of numeric range.');
  });

  it('-Infinity returns "Result is out of numeric range."', () => {
    assert.equal(formatNumber(-Infinity), 'Result is out of numeric range.');
  });

  it('NaN returns "Result is out of numeric range."', () => {
    assert.equal(formatNumber(NaN), 'Result is out of numeric range.');
  });
});
