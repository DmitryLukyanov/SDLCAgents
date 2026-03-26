# Implementation plan (Spec Kit — plan)

## Global directive (all agents)

Do not assume, ask

## Overview

Add a `calculator` module to the existing TypeScript codebase. Favour small, reviewable changes. Use only Node.js built-in `Math` for trigonometry. No new external dependencies required.

## Stack

- Language: TypeScript (strict, NodeNext module resolution — matches `tsconfig.json`)
- Runtime: Node.js ≥ 20
- No new dependencies

## File structure

```
src/
  calculator/
    calculator.ts      ← pure functions: add, subtract, multiply, divide, sin
```

## Design decisions

- Each operation is an exported named function.
- `divide` throws a `RangeError` with a clear message when divisor is zero.
- `sin` delegates to `Math.sin` (native, fast, correct).
- No class wrapper — plain functions are consistent with existing lib helpers.
- Input type: `number` for all parameters and return values.

## Validation

- Run `npm run check` (TypeScript type-check) after implementation to ensure no regressions.

_Jira: TC-5_
