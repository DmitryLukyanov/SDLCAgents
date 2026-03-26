import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------------------------------------------------------------------------
// T006 / T011 / T015 — CLI subprocess integration tests
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'src', 'calculator', 'cli.ts');
const NODE_BIN = process.execPath;

/**
 * Spawn `node --import tsx/esm src/calculator/cli.ts <args...>` and return
 * stdout, stderr, and exit code.
 */
async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(
      NODE_BIN,
      ['--import', 'tsx/esm', CLI_PATH, ...args],
      { cwd: REPO_ROOT },
    );
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: (e.stdout ?? '').trim(),
      stderr: (e.stderr ?? '').trim(),
      exitCode: e.code ?? 1,
    };
  }
}

// ---------------------------------------------------------------------------
// T006 — Arithmetic happy paths (US1)
// ---------------------------------------------------------------------------

describe('CLI — arithmetic operations (T006)', () => {
  it('add 3 5 → stdout "8", exit 0', async () => {
    const r = await runCli(['add', '3', '5']);
    assert.equal(r.stdout, '8');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('add 1.5 2.5 → stdout "4", exit 0', async () => {
    const r = await runCli(['add', '1.5', '2.5']);
    assert.equal(r.stdout, '4');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('subtract 10 3 → stdout "7", exit 0', async () => {
    const r = await runCli(['subtract', '10', '3']);
    assert.equal(r.stdout, '7');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('subtract 3.5 1.5 → stdout "2", exit 0', async () => {
    const r = await runCli(['subtract', '3.5', '1.5']);
    assert.equal(r.stdout, '2');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('multiply 2.5 4 → stdout "10", exit 0', async () => {
    const r = await runCli(['multiply', '2.5', '4']);
    assert.equal(r.stdout, '10');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('multiply 6 7 → stdout "42", exit 0', async () => {
    const r = await runCli(['multiply', '6', '7']);
    assert.equal(r.stdout, '42');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('divide 10 4 → stdout "2.5", exit 0', async () => {
    const r = await runCli(['divide', '10', '4']);
    assert.equal(r.stdout, '2.5');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('divide 9 3 → stdout "3", exit 0', async () => {
    const r = await runCli(['divide', '9', '3']);
    assert.equal(r.stdout, '3');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });
});

// ---------------------------------------------------------------------------
// T011 — Sine happy paths (US2)
// ---------------------------------------------------------------------------

describe('CLI — sine operation (T011)', () => {
  it('sin 0 → stdout "0", exit 0', async () => {
    const r = await runCli(['sin', '0']);
    assert.equal(r.stdout, '0');
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
  });

  it('sin π/2 → stdout "1", exit 0', async () => {
    const r = await runCli(['sin', '1.5707963267948966']);
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
    assert.ok(Math.abs(Number(r.stdout) - 1) < 1e-10, `expected ≈ 1, got ${r.stdout}`);
  });

  it('sin -π/2 → stdout "-1", exit 0', async () => {
    const r = await runCli(['sin', '-1.5707963267948966']);
    assert.equal(r.stderr, '');
    assert.equal(r.exitCode, 0);
    assert.ok(Math.abs(Number(r.stdout) - -1) < 1e-10, `expected ≈ -1, got ${r.stdout}`);
  });
});

// ---------------------------------------------------------------------------
// T015 — Error paths (US3)
// ---------------------------------------------------------------------------

describe('CLI — error paths (T015)', () => {
  it('no args → stderr usage, exit 1', async () => {
    const r = await runCli([]);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'Error: Usage: calc <operation> [operands...]');
    assert.equal(r.exitCode, 1);
  });

  it('unknown op "cos" → stderr unsupported, exit 1', async () => {
    const r = await runCli(['cos', '1']);
    assert.equal(r.stdout, '');
    assert.equal(
      r.stderr,
      'Error: Unsupported operation: "cos". Supported: add, subtract, multiply, divide, sin',
    );
    assert.equal(r.exitCode, 1);
  });

  it('unknown op "tan" → stderr unsupported, exit 1', async () => {
    const r = await runCli(['tan', '1']);
    assert.equal(r.stdout, '');
    assert.equal(
      r.stderr,
      'Error: Unsupported operation: "tan". Supported: add, subtract, multiply, divide, sin',
    );
    assert.equal(r.exitCode, 1);
  });

  it('unknown op "cot" → stderr unsupported, exit 1', async () => {
    const r = await runCli(['cot', '1']);
    assert.equal(r.stdout, '');
    assert.equal(
      r.stderr,
      'Error: Unsupported operation: "cot". Supported: add, subtract, multiply, divide, sin',
    );
    assert.equal(r.exitCode, 1);
  });

  it('add with 1 operand → stderr wrong count, exit 1', async () => {
    const r = await runCli(['add', '3']);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'Error: "add" requires 2 numeric operands');
    assert.equal(r.exitCode, 1);
  });

  it('sin with 2 operands → stderr wrong count, exit 1', async () => {
    const r = await runCli(['sin', '1', '2']);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'Error: "sin" requires 1 numeric operand');
    assert.equal(r.exitCode, 1);
  });

  it('add abc 3 → stderr non-numeric, exit 1', async () => {
    const r = await runCli(['add', 'abc', '3']);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'Error: Invalid input: "abc" is not a number');
    assert.equal(r.exitCode, 1);
  });

  it('divide 5 0 → stderr division by zero, exit 1', async () => {
    const r = await runCli(['divide', '5', '0']);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'Error: Division by zero');
    assert.equal(r.exitCode, 1);
  });
});
