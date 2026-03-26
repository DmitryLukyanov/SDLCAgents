# Tasks (Spec Kit — tasks)

## Global directive (all agents)

Do not assume, ask

List concrete, ordered tasks (setup, core change, tests, polish). Keep each task small enough for one focused commit or PR.

## Task list

### Task 1 — Core module

Create `src/calculator/calculator.ts` with a `Calculator` class exposing:
- `static add(a: number, b: number): number`
- `static subtract(a: number, b: number): number`
- `static multiply(a: number, b: number): number`
- `static divide(a: number, b: number): number` — throws on `b === 0`
- `static sin(x: number): number`

### Task 2 — CLI entry point

Create `src/calculator/calculator-entry.ts` that:
- Reads `process.argv[2]` (operation) and `process.argv[3]`, `process.argv[4]` (operands).
- Calls the appropriate `Calculator` method and prints the result.
- Prints usage instructions when arguments are missing or invalid.

### Task 3 — Local debug / smoke-test

Create `tests/calculator/calculator.local-debug.ts` following the pattern of
`tests/scrum-agent/scrum-master.local-debug.ts`:
- Exercises all five operations.
- Verifies divide-by-zero throws.
- Prints pass/fail summary.

### Task 4 — Wire up `package.json`

Add a `"calculator"` script: `"tsx src/calculator/calculator-entry.ts"`.

### Task 5 — Spec artifacts

Write `spec-output/TC-5/constitution.md`, `spec.md`, `plan.md`, `tasks.md`.

### Task 6 — Typecheck

Run `npm run check` and confirm zero errors.

_Jira: TC-5_
