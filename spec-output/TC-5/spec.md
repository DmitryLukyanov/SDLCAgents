# Specification

## Global directive (all agents)

Do not assume, ask

## Intent (Spec Kit — specify)

Create the feature specification from the Jira context above

## Source: Jira TC-5

### Summary

Create simple calculator

### Description

Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## Scope

Implement a TypeScript calculator module that exposes:

- **add(a, b)** — addition
- **subtract(a, b)** — subtraction
- **multiply(a, b)** — multiplication
- **divide(a, b)** — division (throws on divide-by-zero)
- **sin(x)** — sine of x (radians)

## Goals

- Provide a reusable, pure-function calculator library in the existing TypeScript codebase.
- Support the five operations above and no others (cos/tg/ctg are explicitly excluded).
- Keep the codebase buildable and typecheck-clean after the change.

## Acceptance Criteria

1. `add`, `subtract`, `multiply`, `divide`, and `sin` are exported from `src/calculator/calculator.ts`.
2. `divide(a, 0)` throws a meaningful `Error`.
3. `sin(Math.PI / 6)` returns approximately 0.5.
4. The module compiles without TypeScript errors (`npm run check`).
5. A runnable demo/test script exercises all five operations.
