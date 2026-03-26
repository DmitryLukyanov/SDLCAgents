# Implementation plan (Spec Kit — plan)

## Global directive (all agents)

Do not assume, ask

Use the stack already present in this repository. Favor minimal, incremental changes. Align with the constitution.

_Jira: TC-5_

---

## Technical Implementation Plan: Simple Calculator

### Stack

- **Language**: TypeScript (matches existing repository stack).
- **Runtime**: Node.js ≥ 20 (as required by `engines` in `package.json`).
- **Module format**: ESM (`"type": "module"` in `package.json`).
- **Build / run**: `tsx` (already a dev-dependency); no extra dependencies needed.
- **Type checking**: `tsc --noEmit` via the existing `check` script.

### Architecture

```
src/
  calculator/
    calculator.ts          ← pure library (add, subtract, multiply, divide, sin)
    calculator-cli.ts      ← thin CLI wrapper (reads argv, calls library, prints result)
tests/
  calculator/
    calculator.test.ts     ← tsx-executed tests, mirrors existing tests/ pattern
```

### Library (`calculator.ts`)

Exports five pure functions:

| Export | Signature | Notes |
|---|---|---|
| `add` | `(a: number, b: number): number` | `a + b` |
| `subtract` | `(a: number, b: number): number` | `a - b` |
| `multiply` | `(a: number, b: number): number` | `a * b` |
| `divide` | `(a: number, b: number): number` | throws `Error` when `b === 0` |
| `sin` | `(x: number): number` | delegates to `Math.sin(x)` |

No `cos`, `tan`, `cot`, or other trigonometric functions are included (FR-006).

### CLI (`calculator-cli.ts`)

- Reads `process.argv[2]` as the operation name.
- Reads `process.argv[3]` (and `process.argv[4]` for binary ops) as numbers.
- Validates inputs; exits with code 1 and an error message on bad input.
- Prints the result to stdout.

Usage examples:
```
tsx src/calculator/calculator-cli.ts add 3 4        # → 7
tsx src/calculator/calculator-cli.ts divide 10 0   # → Error: Division by zero
tsx src/calculator/calculator-cli.ts sin 0          # → 0
```

### Tests

Following the existing pattern (tsx-executed TypeScript files in `tests/`):

- Happy-path for all five operations.
- Division by zero throws an error.
- The `sin` function is not called `cos`/`tan`/`cot` (negative assertion).

### package.json change

Add one script:
```json
"calculator": "tsx src/calculator/calculator-cli.ts"
```

### Constraints

- No new npm dependencies; `Math.sin` from the standard library is sufficient.
- The codebase must remain typecheck-clean after each commit.
- Do not weaken existing tests.
