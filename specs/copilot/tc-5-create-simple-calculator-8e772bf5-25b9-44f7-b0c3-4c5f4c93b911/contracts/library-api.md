# Contract: Calculator Library API

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-29  
**Feature**: TC-5 Simple Calculator  
**Contract type**: TypeScript public API (importable library module)

---

## Overview

The calculator exposes a single importable entry point at `src/calculator/index.ts`. Consumers call `calculate(expression)` with a raw string and receive a `CalculatorResult`. All types are re-exported from that entry point.

This contract is technology-specific (TypeScript / ESM) because the feature is explicitly a TypeScript library (see spec Assumptions).

---

## Public Entry Point

```
src/calculator/index.ts
```

**Import path** (within the monorepo, using NodeNext resolution):
```typescript
import { calculate, formatNumber } from './src/calculator/index.ts';
// or from a sibling module:
import { calculate, formatNumber } from '../calculator/index.ts';
```

---

## Exported Types

```typescript
// ── Operation ────────────────────────────────────────────────────────────────

export enum Operation {
  Add      = '+',
  Subtract = '-',
  Multiply = '*',
  Divide   = '/',
  Sin      = 'sin',
}

// ── ParsedExpression ─────────────────────────────────────────────────────────

export interface BinaryExpression {
  kind: 'binary';
  operator: Operation.Add | Operation.Subtract | Operation.Multiply | Operation.Divide;
  left: number;
  right: number;
}

export interface UnaryExpression {
  kind: 'unary';
  operator: Operation.Sin;
  operand: number;  // degrees; conversion to radians is an internal implementation detail
}

export type ParsedExpression = BinaryExpression | UnaryExpression;

// ── Parse result ─────────────────────────────────────────────────────────────

export interface ParseError {
  kind: 'parse-error';
  message: string;
}

export type ParseResult = ParsedExpression | ParseError;

// ── Calculator result ─────────────────────────────────────────────────────────

export interface SuccessResult {
  kind: 'success';
  value: number;
}

export interface ErrorResult {
  kind: 'error';
  message: string;
}

export type CalculatorResult = SuccessResult | ErrorResult;
```

---

## Exported Functions

### `calculate(expression: string): CalculatorResult`

**Signature**:
```typescript
export function calculate(expression: string): CalculatorResult;
```

**Contract**:
- Accepts any `string`, including empty or whitespace-only strings.
- Internally calls `parse(expression)` then evaluates the parsed form.
- **Never throws**; all error conditions are returned as `ErrorResult`.
- Returns a `SuccessResult` when the expression is valid and evaluation produces a finite number.
- Returns an `ErrorResult` for: parse failures, division by zero, non-finite results.

**Preconditions**: None (function is total — defined for all string inputs).

**Postconditions**:
- `result.kind === 'success'` → `result.value` is a finite, non-NaN `number`.
- `result.kind === 'error'` → `result.message` is a non-empty human-readable string.

**Examples**:
```typescript
calculate('5 + 3')     // { kind: 'success', value: 8 }
calculate('10 - 4')    // { kind: 'success', value: 6 }
calculate('6 * 7')     // { kind: 'success', value: 42 }
calculate('15 / 3')    // { kind: 'success', value: 5 }
calculate('7 / 0')     // { kind: 'error',   message: 'Division by zero is not allowed.' }
calculate('sin(0)')    // { kind: 'success', value: 0 }
calculate('sin(30)')   // { kind: 'success', value: 0.5 }
calculate('sin(90)')   // { kind: 'success', value: 1 }
calculate('sin(-90)')  // { kind: 'success', value: -1 }
calculate('')          // { kind: 'error',   message: 'Please enter a valid expression.' }
calculate('cos(30)')   // { kind: 'error',   message: 'Unsupported operation. Supported: +, -, *, /, sin.' }
calculate('5 +')       // { kind: 'error',   message: 'Incomplete expression. Expected: <number> <+|-|*|/> <number>.' }
```

---

### `formatNumber(value: number): string`

**Signature**:
```typescript
export function formatNumber(value: number): string;
```

**Contract**:
- Formats a `number` for display, applying the FR-009 rules.
- **Never throws**; handles `Infinity`, `-Infinity`, and `NaN` gracefully.
- Does **not** perform calculation; purely a formatting utility.

**Postconditions**:
- Finite non-NaN input → at most 10 significant digits, trailing zeros stripped, no decimal point on integers.
- `Infinity`, `-Infinity`, or `NaN` → returns `"Result is out of numeric range"`.

**Examples**:
```typescript
formatNumber(8)               // "8"
formatNumber(0.5)             // "0.5"
formatNumber(1/3)             // "0.3333333333"
formatNumber(Math.PI)         // "3.141592654"
formatNumber(-1)              // "-1"
formatNumber(Infinity)        // "Result is out of numeric range"
formatNumber(NaN)             // "Result is out of numeric range"
```

---

## Internal (Non-Exported) Functions

The following functions are used internally and are **not** part of the public API surface. They may be imported in tests directly by path but must not be depended upon by external consumers.

| Function | File | Purpose |
|----------|------|---------|
| `parse(input: string): ParseResult` | `parser.ts` | Converts raw string → ParsedExpression or ParseError |
| `evaluate(expr: ParsedExpression): CalculatorResult` | `calculator.ts` | Evaluates a parsed expression |
| `sinDegrees(degrees: number): number` | `calculator.ts` | Converts degrees to radians and calls `Math.sin` |

---

## Stability & Versioning

| Symbol | Stability |
|--------|-----------|
| `calculate` | **Stable** — core contract; must not change signature |
| `formatNumber` | **Stable** — formatting utility; output format follows FR-009 |
| `Operation` (enum values) | **Stable** — adding new operations is a breaking change |
| `CalculatorResult`, `ParsedExpression` (types) | **Stable** — narrowing/widening is a breaking change |
| Internal parser regex | **Internal** — not part of the public contract |

---

## Error Message Catalogue

All `message` strings in `ErrorResult` and `ParseError` are stable display strings (the REPL renders them verbatim).

| Condition | Message |
|-----------|---------|
| Blank / whitespace-only input | `"Please enter a valid expression."` |
| Unsupported operation | `"Unsupported operation. Supported: +, -, *, /, sin."` |
| Incomplete binary expression | `"Incomplete expression. Expected: <number> <+\|-\|*\/> <number>."` |
| Unrecognised pattern | `"Invalid expression. Try: 5 + 3 or sin(30)."` |
| Division by zero | `"Division by zero is not allowed."` |
| Non-finite / NaN result | `"Result is out of numeric range."` |
