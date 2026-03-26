# Calculator API Contract (TC-5)

**Feature**: TC-5 — Simple Calculator
**Type**: TypeScript library module contract + CLI command contract
**Date**: 2025-07-18

This document is the authoritative interface contract for `src/calculator/calculator.ts` (library) and `src/calculator/calculator-cli.ts` (CLI). Implementation must not deviate from these signatures.

---

## Library Contract (`src/calculator/calculator.ts`)

### Named Exports

All five functions are synchronous, pure, and have no side effects.

```typescript
/**
 * Returns the sum of two numbers.
 */
export function add(a: number, b: number): number;

/**
 * Returns the difference of two numbers (a - b).
 */
export function subtract(a: number, b: number): number;

/**
 * Returns the product of two numbers.
 */
export function multiply(a: number, b: number): number;

/**
 * Returns the quotient of two numbers (a / b).
 * @throws {Error} "Division by zero is not allowed" when b === 0
 */
export function divide(a: number, b: number): number;

/**
 * Returns the sine of x (in radians).
 * Delegates to Math.sin; accepts any finite real number.
 */
export function sin(x: number): number;

/**
 * Formats a numeric result per FR-010:
 * - At most 10 decimal places
 * - Trailing zeros trimmed
 * - Whole numbers displayed without decimal point
 * Exported to allow unit testing of the formatting rule.
 */
export function formatResult(n: number): string;
```

### Error Behaviour

| Function | Condition | Throws |
|---|---|---|
| `divide` | `b === 0` | `new Error('Division by zero is not allowed')` |
| `add` | none | — |
| `subtract` | none | — |
| `multiply` | none | — |
| `sin` | none | — |

> The library does **not** validate that arguments are finite numbers. That responsibility belongs to the CLI parsing layer. Callers must pass valid numbers.

### Module import (ESM)

```typescript
import { add, subtract, multiply, divide, sin, formatResult } from './calculator.js';
// or from consuming code outside the directory:
import { add, divide, sin } from '../calculator/calculator.js';
```

---

## CLI Command Contract (`src/calculator/calculator-cli.ts`)

### Invocation

Executed via `tsx` (no compile step):

```bash
npx tsx src/calculator/calculator-cli.ts <args>
```

Or, if an npm script is added:

```bash
node --import tsx/esm src/calculator/calculator-cli.ts <args>
```

### Argument Forms

#### Binary operation

```
<left> <operator> <right>
```

| Slot | Type | Allowed values |
|---|---|---|
| `left` | numeric string | Any string where `Number.isFinite(Number(token))` is `true` |
| `operator` | string | `+`, `-`, `*`, `/` |
| `right` | numeric string | Any string where `Number.isFinite(Number(token))` is `true` |

Examples:
```bash
tsx src/calculator/calculator-cli.ts 10 + 5       # → 15
tsx src/calculator/calculator-cli.ts 1 / 3        # → 0.3333333333
tsx src/calculator/calculator-cli.ts -5 + 3       # → -2   (FR-011: negative number, not a flag)
tsx src/calculator/calculator-cli.ts 10 - -5      # → 15
```

#### Unary operation (`sin`)

```
sin <operand>
```

| Slot | Type | Allowed values |
|---|---|---|
| `sin` | literal | Must be the exact string `"sin"` |
| `operand` | numeric string | Any string where `Number.isFinite(Number(token))` is `true` |

Examples:
```bash
tsx src/calculator/calculator-cli.ts sin 0          # → 0
tsx src/calculator/calculator-cli.ts sin 1.5708     # → 1  (≈ sin(π/2))
tsx src/calculator/calculator-cli.ts sin -1.5708    # → -1
```

### Standard Output (success)

- Exactly one line printed to **stdout**.
- Format: `formatResult(result)` — see library contract.
- No trailing newline other than the one from `console.log`.

### Standard Error (failure)

- Error message printed to **stderr** via `console.error`.
- Nothing printed to **stdout** on failure.
- Process exits with code **`1`**.

### Exit Codes

| Condition | Code |
|---|---|
| Success | `0` |
| Division by zero | `1` |
| Non-numeric operand (e.g., `foo`) | `1` |
| Unsupported operator (e.g., `cos`) | `1` |
| Wrong number of arguments | `1` |

### Error Messages

| Condition | Message (stderr) |
|---|---|
| Division by zero | `Error: Division by zero is not allowed` |
| Non-numeric input: `foo` | `Error: "foo" is not a valid number` |
| Unsupported operator: `cos` | `Error: Unsupported operator "cos". Supported operators: +, -, *, /, sin` |
| Wrong arg count (0, 1, 4+) | `Usage: calc <number> <+\|-|*|/> <number>` + newline + `       calc sin <number>` |

---

## Test Runner Contract (`tests/calculator/calculator.test.ts`)

### Run command

```bash
node --import tsx/esm --test tests/calculator/calculator.test.ts
```

### Required test coverage

| Area | Tests required |
|---|---|
| `add` | positive integers, floats, negatives |
| `subtract` | normal, zero result, negative result |
| `multiply` | integers, floats, multiply-by-zero |
| `divide` | normal, fractional precision, division-by-zero throws |
| `sin` | `sin(0)=0`, `sin(π/2)≈1`, `sin(-π/2)≈-1`, large number no crash |
| `formatResult` | whole number, trimmed decimals, max 10 d.p. |
| CLI integration | success cases (binary + unary), error cases (zero div, bad input, bad op, wrong argc), negative operand |

### Import path

```typescript
import { add, subtract, multiply, divide, sin, formatResult } from '../../src/calculator/calculator.js';
import { spawnSync } from 'node:child_process';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```
