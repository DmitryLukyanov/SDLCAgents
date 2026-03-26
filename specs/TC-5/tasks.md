# Tasks (Spec Kit — tasks)

## Global directive (all agents)

Do not assume, ask

## Task list

### Task 1 — Create calculator module

**File:** `src/calculator/calculator.ts`

Implement and export the following pure functions:

| Function | Signature | Notes |
|---|---|---|
| `add` | `(a: number, b: number) => number` | Returns `a + b` |
| `subtract` | `(a: number, b: number) => number` | Returns `a - b` |
| `multiply` | `(a: number, b: number) => number` | Returns `a * b` |
| `divide` | `(a: number, b: number) => number` | Throws `RangeError` when `b === 0` |
| `sin` | `(a: number) => number` | Delegates to `Math.sin(a)`; input in radians |

No other trigonometric functions (`cos`, `tan`, `cot`) are permitted.

### Task 2 — Type-check

Run `npm run check` and confirm the project still type-checks cleanly with zero errors.

_Jira: TC-5_
