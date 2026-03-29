# Data Model: Simple Calculator

**Phase**: 1 — Design & Contracts  
**Feature**: Simple Calculator Library  
**Branch**: `copilot/create-simple-calculator`

---

## Overview

The calculator is a **pure-function library** with no persistent state, no entities, and no database. The "data model" describes the TypeScript types, function signatures, and invariants that govern all data flowing through the module.

---

## 1. Core Types

### 1.1 `CalcNumber` (alias)

```typescript
// src/lib/calculator.ts
type CalcNumber = number;  // IEEE 754 float64; may be Infinity | -Infinity but NOT NaN
```

**Description**: The single numeric type accepted and returned by all calculator functions. `NaN` is explicitly **excluded** (runtime validation rejects it). `Infinity` / `-Infinity` are **included** per IEEE 754 semantics (FR-010, FR-011).

| Value | Accepted as input? | Produced as output? |
|---|---|---|
| Integer (e.g. `42`) | ✅ | ✅ |
| Float (e.g. `3.14`) | ✅ | ✅ |
| `Infinity` / `-Infinity` | ✅ | ✅ (IEEE 754) |
| `NaN` | ❌ throws `TypeError` | ❌ (input guard prevents) |
| Non-number types (string, `undefined`, `null`, …) | ❌ throws `TypeError` | N/A |

---

### 1.2 Shared Input Guard

```typescript
// Internal — not exported
function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    const received = Number.isNaN(value) ? 'NaN' : typeof value;
    throw new TypeError(
      `Argument '${name}' must be a valid number; received ${received}.`
    );
  }
}
```

**Called by**: every exported function, on every argument, before any computation.

---

## 2. Function Signatures

### 2.1 `add(a, b) → number`

| Field | Value |
|---|---|
| Parameters | `a: number`, `b: number` |
| Returns | `number` — the arithmetic sum `a + b` |
| Throws | `TypeError` if `a` or `b` is not a valid number |
| State change | None |
| Side effects | None |

**Invariants**:
- `add(0, 0) === 0`
- `add(a, b) === add(b, a)` (commutativity)
- Result is precise within float64 bounds

---

### 2.2 `subtract(a, b) → number`

| Field | Value |
|---|---|
| Parameters | `a: number`, `b: number` |
| Returns | `number` — the arithmetic difference `a - b` |
| Throws | `TypeError` if `a` or `b` is not a valid number |
| State change | None |
| Side effects | None |

---

### 2.3 `multiply(a, b) → number`

| Field | Value |
|---|---|
| Parameters | `a: number`, `b: number` |
| Returns | `number` — the arithmetic product `a * b` |
| Throws | `TypeError` if `a` or `b` is not a valid number |
| State change | None |
| Side effects | None |

---

### 2.4 `divide(a, b) → number`

| Field | Value |
|---|---|
| Parameters | `a: number` (dividend), `b: number` (divisor) |
| Returns | `number` — the quotient `a / b` |
| Throws | `TypeError` if `a` or `b` is not a valid number |
| Throws | `Error` ("Division by zero") if `b === 0` |
| State change | None |
| Side effects | None |

**Invariants**:
- `b === 0` → always throws (even if `a` is also `0`)
- `b === Infinity` → returns `0` (IEEE 754 semantics; not an error)

---

### 2.5 `sin(x) → number`

| Field | Value |
|---|---|
| Parameters | `x: number` — angle in **radians** |
| Returns | `number` — sine of `x`; range `[-1, 1]` for finite inputs |
| Throws | `TypeError` if `x` is not a valid number |
| Precision | Up to 10 decimal places (delegated to `Math.sin`) |
| State change | None |
| Side effects | None |

**Invariants**:
- `sin(0) === 0`
- `sin(Math.PI / 2) ≈ 1` (within float64 precision)
- `sin(Math.PI / 6) ≈ 0.5` (within float64 precision)

---

## 3. Error Taxonomy

| Error Type | Trigger | Message Pattern |
|---|---|---|
| `TypeError` | Non-number or NaN argument | `"Argument '<name>' must be a valid number; received <type>."` |
| `Error` | `divide(a, 0)` | `"Division by zero: divisor must not be 0."` |

No other errors are thrown by the library under normal operation.

---

## 4. Module Shape (Public Surface)

```typescript
// What callers see when they import the module
export declare function add(a: number, b: number): number;
export declare function subtract(a: number, b: number): number;
export declare function multiply(a: number, b: number): number;
export declare function divide(a: number, b: number): number;
export declare function sin(x: number): number;

// NOT exported: cos, tan, cot, or any other trigonometric function (FR-007)
// NOT exported: assertNumber (internal guard)
```

---

## 5. Statelessness Guarantee

- No module-level `let` or `var` variables holding mutable state.
- No class instances, caches, or history arrays.
- Each call is fully independent — calling a function after a previous call that threw proceeds normally (SC-006).

---

## 6. Precision Model

| Operation | Source | Precision |
|---|---|---|
| `add`, `subtract`, `multiply`, `divide` | Native JS `+`, `-`, `*`, `/` operators | IEEE 754 float64 (~15–17 significant digits) |
| `sin` | `Math.sin` (V8/SpiderMonkey native) | IEEE 754 float64; up to 10 decimal places (SC-002) |

No custom rounding is applied. Results outside float64 range naturally become `Infinity` / `-Infinity` per IEEE 754 (FR-011).
