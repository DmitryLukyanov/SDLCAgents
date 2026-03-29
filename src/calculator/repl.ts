// T009: REPL — readline loop with prompt '> '

import * as readline from 'node:readline';
import { evaluate } from './parser.js';
import { format } from './formatter.js';

export function startRepl(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    rl.close();
    process.exit(0);
  });

  function prompt(): void {
    rl.question('> ', (line: string) => {
      const trimmed = line.trim();

      if (trimmed === '') {
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        rl.close();
        process.exit(0);
      }

      try {
        const result = evaluate(trimmed);
        process.stdout.write(format(result) + '\n');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stdout.write(`Error: ${message}\n`);
      }

      prompt();
    });
  }

  prompt();
}
