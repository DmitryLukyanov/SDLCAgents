# Specification — TC-5: Simple Calculator

## Intent (Spec Kit — specify)

Build a simple calculator module that exposes the four arithmetic operations
(addition, subtraction, multiplication, division) and the `sin` trigonometric
function. Only `sin` is in scope; `cos`, `tan`, `cot`, and any other
trigonometric functions are explicitly excluded.

## Scope & Goals

- Provide a TypeScript module (`src/calculator/calculator.ts`) with a clean,
  type-safe API.
- Support: `add`, `subtract`, `multiply`, `divide`, `sin`.
- Guard against division by zero (throw a descriptive `Error`).
- Integrate naturally with the existing TypeScript/tsx stack — no new runtime
  dependencies required.
- Include a runnable test/debug script (`tests/calculator/calculator.test.ts`)
  consistent with other test scripts in the repository.

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | `add(a, b)` returns `a + b`. |
| 2 | `subtract(a, b)` returns `a - b`. |
| 3 | `multiply(a, b)` returns `a * b`. |
| 4 | `divide(a, b)` returns `a / b` for `b ≠ 0`. |
| 5 | `divide(a, 0)` throws `Error('Division by zero')`. |
| 6 | `sin(x)` returns the sine of `x` (radians), matching `Math.sin`. |
| 7 | No `cos`, `tan`, `cot`, or other trig functions are exposed. |
| 8 | The module type-checks cleanly (`npm run check` passes). |
| 9 | The test script runs without error (`tsx tests/calculator/calculator.test.ts`). |

## Out of Scope

- GUI / CLI entry-point (module only).
- `cos`, `tan`, `cot`, and all other trigonometric functions.
- Floating-point rounding utilities.
- Expression parsing / infix notation.

## Source: Jira TC-5

### Summary

Create simple calculator

### Description

Create calculator that supports basic operations like -, +, *, /. But on top
of this it must support sin (only, do not add cos, tg, ctg).
