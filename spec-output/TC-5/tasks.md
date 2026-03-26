# Tasks (Spec Kit — tasks)

## Global directive (all agents)

Do not assume, ask

List concrete, ordered tasks (setup, core change, tests, polish). Keep each task small enough for one focused commit or PR.

_Jira: TC-5_

---

## Task List: Simple Calculator

### Task 1 — Create calculator library

**File**: `src/calculator/calculator.ts`

Implement and export pure functions:
- `add(a, b)` → `a + b`
- `subtract(a, b)` → `a - b`
- `multiply(a, b)` → `a * b`
- `divide(a, b)` → `a / b` (throws `Error('Division by zero')` when `b === 0`)
- `sin(x)` → `Math.sin(x)`

No other functions. Typecheck must pass.

---

### Task 2 — Create CLI entry point

**File**: `src/calculator/calculator-cli.ts`

Thin wrapper over the library:
- Parse `process.argv` for operation name and numeric operands.
- Validate inputs (unknown operation → exit 1; non-numeric operand → exit 1).
- Call the appropriate library function and print result to stdout.
- On error (e.g. division by zero), print error message to stderr and exit 1.

---

### Task 3 — Add npm script

**File**: `package.json`

Add `"calculator": "tsx src/calculator/calculator-cli.ts"` to the `scripts` section.

---

### Task 4 — Write tests

**File**: `tests/calculator/calculator.test.ts`

Cover:
- `add(2, 3)` → `5`
- `subtract(10, 4)` → `6`
- `multiply(3, 7)` → `21`
- `divide(10, 2)` → `5`
- `divide(5, 0)` → throws `Error` containing "zero"
- `sin(0)` → `0`
- `sin(Math.PI / 2)` ≈ `1`

Add `"test:calculator": "tsx tests/calculator/calculator.test.ts"` to `package.json`.

---

### Task 5 — Verify typecheck

Run `npm run check` and confirm zero errors.
