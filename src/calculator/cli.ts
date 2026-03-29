#!/usr/bin/env node
/**
 * Calculator REPL — interactive command-line interface.
 * Reads expressions from stdin, evaluates them, and prints results to stdout.
 * Type "exit" or "quit" (case-insensitive) to end the session.
 */

import { createInterface } from 'node:readline';
import { calculate } from './calculator.js';
import { formatNumber } from './formatter.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.log('Calculator REPL — type "exit" to quit');

function prompt(): void {
  process.stdout.write('> ');
}

prompt();

rl.on('line', (rawLine: string) => {
  const line = rawLine.trim();

  if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
    console.log('Goodbye.');
    rl.close();
    process.exit(0);
  }

  const result = calculate(line);

  if (result.kind === 'success') {
    console.log(formatNumber(result.value));
  } else {
    console.log(result.message);
  }

  prompt();
});

rl.on('close', () => {
  // EOF (Ctrl-D or piped input exhausted) — exit cleanly
  process.exit(0);
});

// Handle Ctrl-C gracefully (readline already handles this, but belt-and-braces)
process.on('SIGINT', () => {
  process.exit(0);
});
