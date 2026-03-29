# Data Model: Simple Calculator

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-29  
**Feature**: TC-5 Simple Calculator

---

## Overview

The calculator operates on a stateless request–response model. A user submits a raw string expression; the system parses it, evaluates it, and returns a result (value or error). There are no persistent entities, no database, and no inter-session state.

---

## Entities

### 1. `Operation` (Enum)

Enumerates the five operations the calculator supports.

```typescript
export enum Operation {
  Add      = '+',
  Subtract = '-',
  Multiply = '*',
  Divide   = '/',
  Sin      = 'sin',
}
```

**Validation rules**:
- Any string not in this enum is rejected with an "unsupported operation" error.
- `cos`, `tan`, `cot`, `%`, `^` etc. are explicitly unsupported (FR-006, SC-004).

---

### 2. `ParsedExpression` (Union Type)

Represents a successfully parsed user input. Two variants reflect the two structural forms.

```typescript
export type ParsedExpression = BinaryExpression | UnaryExpression;

export interface BinaryExpression {
  kind: 'binary';
  operator: Operation.Add | Operation.Subtract | Operation.Multiply | Operation.Divide;
  left: number;
  right: number;
}

export interface UnaryExpression {
  kind: 'unary';
  operator: Operation.Sin;
  operand: number;   // angle in degrees; conversion to radians happens in calculator.ts
}
```

**Fields**:

| Field | Type | Constraints |
|-------|------|-------------|
| `kind` | `'binary' \| 'unary'` | Discriminant; set by parser |
| `operator` | `Operation` | Must be one of the five supported operations |
| `left` | `number` | Parsed from string; IEEE 754 double; any finite value |
| `right` | `number` | Parsed from string; IEEE 754 double; any finite value |
| `operand` | `number` | Parsed from string; IEEE 754 double; any finite value |

---

### 3. `ParseError` (Interface)

Returned when the raw input cannot be mapped to a `ParsedExpression`.

```typescript
export interface ParseError {
  kind: 'parse-error';
  message: string;   // human-readable; displayed directly in the REPL
}
```

**Error message catalogue** (populated by `parser.ts`):

| Trigger | `message` |
|---------|-----------|
| Blank / whitespace-only input | `"Please enter a valid expression."` |
| Unsupported function (e.g., `cos`, `tan`) | `"Unsupported operation. Supported: +, -, *, /, sin."` |
| Incomplete binary expression (e.g., `5 +`) | `"Incomplete expression. Expected: <number> <+\|-\|*\/> <number>."` |
| Unrecognised pattern | `"Invalid expression. Try: 5 + 3 or sin(30)."` |

---

### 4. `CalculatorResult` (Union Type)

Represents the outcome of evaluating a `ParsedExpression`.

```typescript
export type CalculatorResult = SuccessResult | ErrorResult;

export interface SuccessResult {
  kind: 'success';
  value: number;
}

export interface ErrorResult {
  kind: 'error';
  message: string;   // human-readable; displayed directly in the REPL
}
```

**Error message catalogue** (populated by `calculator.ts`):

| Trigger | `message` |
|---------|-----------|
| Division by zero (`right === 0` and `operator === '/'`) | `"Division by zero is not allowed."` |
| Result is `Infinity`, `-Infinity`, or `NaN` | `"Result is out of numeric range."` |

---

### 5. `DisplayString` (Derived Value — no separate type)

The final human-readable string produced by `formatter.ts` from a `CalculatorResult`. Not a stored entity; computed on demand.

**Formatting rules**:
- `ErrorResult` → emit `message` directly.
- `SuccessResult` where `!isFinite(value)` or `isNaN(value)` → emit `"Result is out of numeric range."` (defensive; calculator should have caught this already).
- `SuccessResult` with a finite value → `parseFloat(value.toPrecision(10)).toString()`.

**Examples**:
| `value` | `DisplayString` |
|---------|----------------|
| `8` | `"8"` |
| `0.5` | `"0.5"` |
| `0.3333333333…` (1/3) | `"0.3333333333"` |
| `3.141592653…` (π) | `"3.141592654"` |
| `-1` | `"-1"` |

---

## State Transitions

The calculator is fully stateless per expression. The only "lifecycle" is the REPL session in `cli.ts`:

```
[Session Start]
      │
      ▼
[Await Input] ◄──────────────────────────────────┐
      │                                           │
      ▼                                           │
[Trim & check for 'exit'/'quit'] ── yes ──► [Close readline, exit 0]
      │ no
      ▼
[parser.ts: parse(rawInput)] ──► ParseError ──► print message ──► back to await
      │ ParsedExpression
      ▼
[calculator.ts: evaluate(expression)] ──► ErrorResult ──► print message ──► back to await
      │ SuccessResult
      ▼
[formatter.ts: formatResult(result)] ──► print DisplayString ──────────────────┘
```

---

## Validation Rules (summary)

| Rule | Enforced In | Requirement |
|------|-------------|-------------|
| Only +, -, *, /, sin supported | `parser.ts` | FR-005, FR-006 |
| Operands must be valid numbers | `parser.ts` (regex) | FR-008 |
| Division by zero | `calculator.ts` | FR-004 |
| Overflow / NaN guard | `calculator.ts` (post-compute `isFinite`/`isNaN` check) | FR-011 |
| Result format (integer or 10 sig figs) | `formatter.ts` | FR-009 |
| Blank / incomplete input | `parser.ts` | FR-007 |
| Unsupported trig functions | `parser.ts` | FR-006, SC-004 |
| `exit` / `quit` terminates session | `cli.ts` | FR-010 |

---

## Non-Entities (explicitly out of scope)

- **History** — no expression log, no last-result variable
- **Memory** — no `M+`, `M-`, `MR` operations
- **User account** — single-user tool, no authentication
- **Chained expressions** — `1 + 2 + 3` is not supported; the parser will reject it with an invalid-expression message
