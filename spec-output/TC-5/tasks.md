# Tasks (Spec Kit — tasks)

## Global directive (all agents)

Do not assume, ask

## Ordered task list

### Task 1 — Create calculator core module

**File:** `src/calculator/calculator.ts`

Export pure functions: `add`, `subtract`, `multiply`, `divide`, `sin`.
- `divide` must throw `Error('Division by zero')` when the divisor is `0`.
- `sin` wraps `Math.sin` and accepts radians; document this in JSDoc.
- All functions must be strictly typed (`(a: number, b: number) => number` etc.).

### Task 2 — Create CLI entry point

**File:** `src/calculator/calculator-entry.ts`

Reads `process.argv` for `<operation> <a> [b]`, calls the appropriate calculator function, and prints the result to stdout. Prints usage and exits with code 1 on bad input.

### Task 3 — Register calculator script in package.json

**Key:** `"calculator"` → `"tsx src/calculator/calculator-entry.ts"`

Allows running the calculator with `npm run calculator -- add 3 4`.

### Task 4 — Create demo / local-debug test

**File:** `tests/calculator/calculator.local-debug.ts`

Exercises all five operations and asserts expected values; prints a summary. Follows the pattern of `tests/scrum-agent/scrum-master.local-debug.ts`.

### Task 5 — Verify typecheck

Run `npm run check` to confirm zero TypeScript errors after all files are created.

_Jira: TC-5_
