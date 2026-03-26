# Implementation Plan — TC-5: Simple Calculator

_Jira: TC-5_

## Approach

Use the stack already present in this repository (TypeScript ≥ 5, NodeNext
module resolution, `tsx` runner, no extra runtime libraries). Favour minimal,
incremental changes aligned with the project constitution.

## File layout

```
src/
  calculator/
    calculator.ts        ← core module (exported functions)

tests/
  calculator/
    calculator.test.ts   ← runnable debug/test script (no extra test runner)

specs/
  TC-5/
    spec.md              ← feature specification (this set of artifacts)
    plan.md
    tasks.md
```

## Design decisions

1. **Pure functions only** — each operation is a standalone exported function;
   no class or stateful object is needed for this scope.
2. **Radians for `sin`** — `Math.sin` operates in radians; the calculator
   wraps it directly without a unit conversion helper (out of scope).
3. **Error on divide-by-zero** — throw `new Error('Division by zero')` so
   callers can catch it explicitly.
4. **No new dependencies** — the implementation uses only the built-in
   `Math` namespace.
5. **Test script pattern** — mirrors `tests/scrum-agent/scrum-master.local-debug.ts`:
   a plain TypeScript script that logs `PASS`/`FAIL` lines and exits with
   code `1` on any failure.
