# Specification

## Global directive (all agents)

Do not assume, ask

## Intent (Spec Kit — specify)

Create a simple calculator module that supports the following operations:
- Addition (`+`)
- Subtraction (`-`)
- Multiplication (`*`)
- Division (`/`)
- Sine (`sin`) — trigonometric sine of a value in radians

**Scope limitations:**
- Only `sin` is supported; do NOT add `cos`, `tan` (`tg`), `cot` (`ctg`), or any other trigonometric function.
- Division by zero must be handled gracefully (throw a descriptive error).

**Acceptance criteria:**
1. `add(a, b)` returns `a + b`.
2. `subtract(a, b)` returns `a - b`.
3. `multiply(a, b)` returns `a * b`.
4. `divide(a, b)` returns `a / b`; throws when `b === 0`.
5. `sin(a)` returns the trigonometric sine of `a` (radians).
6. The module is importable from the rest of the codebase.
7. TypeScript types are strict and the project type-checks cleanly.

## Source: Jira TC-5

### Summary

Create simple calculator

### Description

Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)
