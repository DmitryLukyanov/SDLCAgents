// T007: REPL integration tests using child_process stdin simulation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, '../../src/calculator/index.ts');
const TSX = join(__dirname, '../../node_modules/.bin/tsx');

/**
 * Run the calculator REPL with the given stdin lines,
 * collect stdout, and return it as a string.
 */
function runCalc(input: string, timeoutMs = 5000): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(TSX, [ENTRY], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`REPL timed out after ${timeoutMs}ms. stdout so far: ${stdout}`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, code });
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

describe('REPL integration', () => {
  it('evaluates a basic expression and prints the result', async () => {
    const { stdout } = await runCalc('10 + 5\nexit\n');
    assert.ok(stdout.includes('15'), `Expected "15" in output, got: ${stdout}`);
  });

  it('empty line produces no output and re-prompts silently', async () => {
    const { stdout } = await runCalc('\nexit\n');
    // Should see two prompts '> ' but no result line between them
    const lines = stdout.split('\n').filter(l => l.trim() !== '' && l.trim() !== '>');
    // No numeric output between empty line and exit
    assert.ok(!lines.some(l => /^\d/.test(l)), `Unexpected output line: ${lines.join(' | ')}`);
  });

  it('exit command exits with code 0', async () => {
    const { code } = await runCalc('exit\n');
    assert.equal(code, 0);
  });

  it('EXIT command (uppercase) exits with code 0', async () => {
    const { code } = await runCalc('EXIT\n');
    assert.equal(code, 0);
  });

  it('quit command exits with code 0', async () => {
    const { code } = await runCalc('quit\n');
    assert.equal(code, 0);
  });

  it('QUIT command (uppercase) exits with code 0', async () => {
    const { code } = await runCalc('QUIT\n');
    assert.equal(code, 0);
  });

  it('a parse error prints Error: <message> then re-prompts without crashing', async () => {
    const { stdout, code } = await runCalc('5 / 0\n10 + 1\nexit\n');
    assert.ok(stdout.includes('Error: Division by zero'), `Expected error in output: ${stdout}`);
    assert.ok(stdout.includes('11'), `Expected "11" after error recovery: ${stdout}`);
    assert.equal(code, 0);
  });

  it('unknown function error prints Error: then re-prompts', async () => {
    const { stdout } = await runCalc('cos(45)\n1 + 1\nexit\n');
    assert.ok(stdout.includes("Error: Unknown function 'cos'"), `Got: ${stdout}`);
    assert.ok(stdout.includes('2'), `Expected recovery result: ${stdout}`);
  });

  it('prompt string is "> "', async () => {
    const { stdout } = await runCalc('exit\n');
    assert.ok(stdout.startsWith('> '), `Expected prompt at start, got: ${stdout}`);
  });

  it('sin(90) evaluates to 1', async () => {
    const { stdout } = await runCalc('sin(90)\nexit\n');
    assert.ok(stdout.includes('1'), `Expected "1" in output: ${stdout}`);
  });
});
