import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { add, subtract, multiply, divide, sin, formatResult } from '../../src/calculator/calculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'src', 'calculator', 'calculator-cli.ts');

function runCli(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', CLI, ...args],
    { encoding: 'utf-8', cwd: ROOT },
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('add', () => {
  it('adds two positive numbers', () => {
    assert.equal(add(2, 3), 5);
  });

  it('adds negative numbers', () => {
    assert.equal(add(-1, -2), -3);
  });

  it('adds zero', () => {
    assert.equal(add(5, 0), 5);
  });
});

describe('subtract', () => {
  it('subtracts two numbers', () => {
    assert.equal(subtract(10, 4), 6);
  });

  it('result can be negative', () => {
    assert.equal(subtract(3, 7), -4);
  });
});

describe('multiply', () => {
  it('multiplies two numbers', () => {
    assert.equal(multiply(4, 5), 20);
  });

  it('multiplies by zero', () => {
    assert.equal(multiply(99, 0), 0);
  });

  it('multiplies negative numbers', () => {
    assert.equal(multiply(-3, 4), -12);
  });
});

describe('divide', () => {
  it('divides two numbers', () => {
    assert.equal(divide(10, 2), 5);
  });

  it('returns a float', () => {
    assert.equal(divide(7, 2), 3.5);
  });

  it('throws on division by zero', () => {
    assert.throws(
      () => divide(5, 0),
      { message: 'Division by zero is not allowed' },
    );
  });
});

describe('sin', () => {
  it('sin(0) === 0', () => {
    assert.equal(sin(0), 0);
  });

  it('sin(π/2) ≈ 1', () => {
    assert.ok(Math.abs(sin(Math.PI / 2) - 1) < 1e-9);
  });

  it('sin(π) ≈ 0', () => {
    assert.ok(Math.abs(sin(Math.PI)) < 1e-9);
  });
});

describe('formatResult', () => {
  it('formats an integer', () => {
    assert.equal(formatResult(5), '5');
  });

  it('strips trailing zeros', () => {
    assert.equal(formatResult(1.5), '1.5');
  });

  it('rounds to 10 decimal places', () => {
    // 1/3 truncated to 10 dp
    const expected = parseFloat((1 / 3).toFixed(10)).toString();
    assert.equal(formatResult(1 / 3), expected);
  });

  it('handles zero', () => {
    assert.equal(formatResult(0), '0');
  });
});

// ---------------------------------------------------------------------------
// CLI integration tests
// ---------------------------------------------------------------------------

describe('CLI – binary operations', () => {
  it('adds via CLI', () => {
    const { stdout, status } = runCli('3', '+', '4');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '7');
  });

  it('subtracts via CLI', () => {
    const { stdout, status } = runCli('10', '-', '3');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '7');
  });

  it('multiplies via CLI', () => {
    const { stdout, status } = runCli('6', '*', '7');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '42');
  });

  it('divides via CLI', () => {
    const { stdout, status } = runCli('15', '/', '4');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '3.75');
  });

  it('handles negative operands via -- separator', () => {
    const { stdout, status } = runCli('--', '-5', '+', '3');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '-2');
  });
});

describe('CLI – sin', () => {
  it('sin 0 via CLI', () => {
    const { stdout, status } = runCli('sin', '0');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '0');
  });

  it('sin is case-insensitive', () => {
    const { stdout, status } = runCli('SIN', '0');
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '0');
  });
});

describe('CLI – errors', () => {
  it('exits 1 on division by zero', () => {
    const { stderr, status } = runCli('5', '/', '0');
    assert.equal(status, 1);
    assert.ok(stderr.includes('Division by zero'));
  });

  it('exits 1 on unknown operator', () => {
    const { stderr, status } = runCli('1', '%', '2');
    assert.equal(status, 1);
    assert.ok(stderr.length > 0);
  });

  it('exits 1 with no arguments', () => {
    const { status } = runCli();
    assert.equal(status, 1);
  });

  it('exits 1 with invalid number', () => {
    const { stderr, status } = runCli('abc', '+', '3');
    assert.equal(status, 1);
    assert.ok(stderr.includes('not a valid number'));
  });
});
