# Data Model: Simple Calculator (TC-5)

**Phase**: 1 — Design & Contracts  
**Branch**: `001-simple-calculator`

---

## Overview

The calculator is a **stateless pure-function module**. There are no persistent entities, no database records, and no object instances. The "data model" describes the types, validation rules, and invariants that govern every function call.

---

## Core Types

### `CalcNumber` (runtime-validated `number`)

A standard JavaScript/TypeScript `number` that has passed the runtime type guard. All function parameters are `CalcNumber` at the semantic level (declared as `number` in the signature, validated at function entry).

```
CalcNumber = number where typeof x === 'number'
```

**Note on NaN as input**: `typeof NaN === 'number'` is `true` in JavaScript. Passing `NaN` as an argument passes the type guard and produces `NaN` as output (IEEE 754 propagation). This is intentional and consistent with JavaScript numeric semantics. Callers must not pass `NaN` if they expect a meaningful result.

---

## Entities

### Operation

Represents a single calculation request. Not materialised as a TypeScript interface — it is implicit in each function call.

| Field | Type | Cardinality | Description |
|-------|------|-------------|-------------|
| `operator` | `'add' \| 'subtract' \| 'multiply' \| 'divide' \| 'sin'` | 1 | Identifies which function is called |
| `operands` | `number[]` | 1 (sin) or 2 (binary ops) | Input numeric values |
| `result` | `number` | 0..1 | Present on success |
| `error` | `Error` | 0..1 | Present on failure (thrown) |

Invariant: exactly one of `result` or `error` is produced per call.

---

### Result

The numeric output of a successful operation.

| Property | Type | Notes |
|----------|------|-------|
| value | `number` | IEEE 754 double-precision float |
| may be `NaN` | yes | Only from mathematical operations (e.g. `sin(Infinity)`). Never from invalid input (those throw). |
| may be `Infinity` | yes | From arithmetic (e.g. `multiply(1e308, 2)`) — not thrown |
| may be `-Infinity` | yes | Same as above |

---

### Error (thrown)

Thrown as a standard `Error` object. No custom subclass needed.

| Scenario | Message pattern |
|----------|-----------------|
| Non-numeric argument `a` | `Argument "a" must be a number, got {typeof a}` |
| Non-numeric argument `b` | `Argument "b" must be a number, got {typeof b}` |
| Non-numeric argument `x` | `Argument "x" must be a number, got {typeof x}` |
| Division by zero | `Division by zero` |

---

## Validation Rules

### All binary operations (`add`, `subtract`, `multiply`, `divide`)

```
PRECONDITION typeof a === 'number'  → else throw Error
PRECONDITION typeof b === 'number'  → else throw Error
```

### `divide` only

```
PRECONDITION b !== 0                → else throw Error('Division by zero')
```

Applied **after** type validation and **before** arithmetic.

### `sin`

```
PRECONDITION typeof x === 'number'  → else throw Error
```

No range validation — all numeric values (including `Infinity`, `-Infinity`, `NaN`) are passed directly to `Math.sin()`.

---

## Validation Order (per function)

```
1. validate type of a (if binary)
2. validate type of b (if binary)
3. if divide: check b !== 0
4. execute Math operation
5. return result
```

No step 5 transformation — results are returned as-is from JavaScript arithmetic/Math.sin().

---

## State Transitions

None — the calculator is stateless. Each call is fully independent.

---

## Numeric Behaviour Reference

| Input | Operation | Result | Notes |
|-------|-----------|--------|-------|
| `add(0.1, 0.2)` | addition | `0.30000000000000004` | IEEE 754 floating point — no rounding |
| `divide(1, 0)` | division | ❌ throws | FR-005 |
| `divide(0, 0)` | division | ❌ throws | b === 0 check fires first |
| `multiply(1e308, 2)` | multiply | `Infinity` | IEEE 754 overflow — valid |
| `sin(0)` | sine | `0` | |
| `sin(Math.PI / 2)` | sine | `1` (≈) | Floating-point rounding |
| `sin(Infinity)` | sine | `NaN` | Valid mathematical NaN |
| `sin(NaN)` | sine | `NaN` | NaN input propagates (typeof NaN === 'number') |
| `add("1", 2)` | addition | ❌ throws | typeof "1" !== 'number' |
