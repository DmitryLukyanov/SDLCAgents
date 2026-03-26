# Specification

## Global directive (all agents)

Do not assume, ask

## Intent (Spec Kit — specify)

Clarify what should be built from the Jira issue below: scope, goals, and acceptance criteria.

## Source: Jira TC-5

### Summary

Create simple calculator

### Description

Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## Scope

A TypeScript module (`src/calculator/calculator.ts`) that exposes a `Calculator` class with the following operations:

| Operation    | Input            | Notes                              |
|-------------|------------------|------------------------------------|
| `add`       | two numbers       | a + b                              |
| `subtract`  | two numbers       | a - b                              |
| `multiply`  | two numbers       | a * b                              |
| `divide`    | two numbers       | throws on division by zero         |
| `sin`       | one number (radians) | delegates to `Math.sin`        |

**Out of scope:** cos, tan (tg), cot (ctg), and any other trigonometric functions.

## Goals

1. Provide a clean, reusable TypeScript module following the existing project patterns.
2. Support basic arithmetic: addition, subtraction, multiplication, division (with divide-by-zero guard).
3. Support sine (radians), and only sine — no other trigonometric functions.
4. Expose a CLI entry point for manual invocation.

## Acceptance criteria

- `Calculator.add(a, b)` returns `a + b`.
- `Calculator.subtract(a, b)` returns `a - b`.
- `Calculator.multiply(a, b)` returns `a * b`.
- `Calculator.divide(a, b)` returns `a / b`; throws `Error` when `b === 0`.
- `Calculator.sin(x)` returns `Math.sin(x)` (input in radians).
- No other trigonometric methods exist on `Calculator`.
- TypeScript strict mode passes with `npm run check`.
