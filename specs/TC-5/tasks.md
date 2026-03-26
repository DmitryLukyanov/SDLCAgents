# Tasks — TC-5: Simple Calculator

_Jira: TC-5_

## Ordered task list

### Task 1 — Core module

**File:** `src/calculator/calculator.ts`

Implement and export five pure functions:

- `add(a: number, b: number): number`
- `subtract(a: number, b: number): number`
- `multiply(a: number, b: number): number`
- `divide(a: number, b: number): number` — throws `Error('Division by zero')` when `b === 0`
- `sin(x: number): number` — delegates to `Math.sin`

### Task 2 — Test script

**File:** `tests/calculator/calculator.test.ts`

Write a self-contained script (pattern: `tests/scrum-agent/scrum-master.local-debug.ts`) that:

- Runs each acceptance criterion from `specs/TC-5/spec.md`.
- Prints `PASS` or `FAIL` per assertion.
- Exits with code `1` if any assertion fails.
- Can be run with `tsx tests/calculator/calculator.test.ts`.

### Task 3 — Spec artifacts

**Files:** `specs/TC-5/{spec,plan,tasks}.md`

Commit the three Spec-Kit artifacts produced by the `specify` / `plan` /
`tasks` agents so the full workflow trail is preserved in the repository.

### Task 4 — Typecheck

Run `npm run check` and confirm zero errors before opening the PR.
