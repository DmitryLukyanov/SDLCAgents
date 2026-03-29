# API Contract: Calculator Library

**Module**: `src/lib/calculator.ts`  
**Type**: TypeScript ESM named exports  
**Feature**: Simple Calculator Library  
**Branch**: `copilot/create-simple-calculator`  
**Contract Version**: 1.0.0

---

## Contract Overview

The calculator library exposes **five named export functions** and **no default export**. All functions are pure, stateless, and synchronous. No class, singleton, or factory is required — callers import and invoke directly.

---

## Import

```typescript
import { add, subtract, multiply, divide, sin } from './lib/calculator.ts';
// or, from compiled output:
import { add, subtract, multiply, divide, sin } from './lib/calculator.js';
```

---

## Exported Functions

### `add(a: number, b: number): number`

Returns the arithmetic sum of `a` and `b`.

```typescript
add(8, 5)       // → 13
add(0.1, 0.2)   // → 0.30000000000000004  (IEEE 754 float64)
add(Infinity, 1) // → Infinity
```

**Errors**:
```typescript
add('8' as any, 5)   // → throws TypeError: "Argument 'a' must be a valid number; received string."
add(NaN, 5)          // → throws TypeError: "Argument 'a' must be a valid number; received NaN."
```

---

### `subtract(a: number, b: number): number`

Returns the arithmetic difference `a − b`.

```typescript
subtract(10, 4)   // → 6
subtract(0, 5)    // → -5
subtract(1e308, -1e308)  // → Infinity
```

**Errors**: Same `TypeError` pattern as `add`.

---

### `multiply(a: number, b: number): number`

Returns the arithmetic product `a × b`.

```typescript
multiply(6, 7)    // → 42
multiply(-3, 4)   // → -12
multiply(1e200, 1e200)  // → Infinity
```

**Errors**: Same `TypeError` pattern as `add`.

---

### `divide(a: number, b: number): number`

Returns the quotient `a ÷ b`.

```typescript
divide(15, 4)    // → 3.75
divide(9, 3)     // → 3
divide(0, 5)     // → 0
divide(1, Infinity)  // → 0  (IEEE 754)
```

**Errors**:
```typescript
divide(9, 0)       // → throws Error: "Division by zero: divisor must not be 0."
divide('x' as any, 2) // → throws TypeError: "Argument 'a' must be a valid number; received string."
divide(9, NaN)     // → throws TypeError: "Argument 'b' must be a valid number; received NaN."
```

> **Note**: `b === 0` always throws, even when `a === 0`. Division by zero is never silently coerced to `NaN` or `Infinity`.

---

### `sin(x: number): number`

Returns the sine of `x` where `x` is expressed in **radians**.

```typescript
sin(0)               // → 0
sin(Math.PI / 2)     // → 1                (within float64 precision)
sin(Math.PI / 6)     // → 0.49999999999999994  (float64 representation of 0.5)
sin(Math.PI)         // → 1.2246467991473532e-16  (float64 representation of 0)
sin(Infinity)        // → NaN              (Math.sin semantics)
```

**Errors**:
```typescript
sin('π/2' as any)   // → throws TypeError: "Argument 'x' must be a valid number; received string."
sin(NaN)            // → throws TypeError: "Argument 'x' must be a valid number; received NaN."
```

> **Scope**: Only `sin` is exported. `cos`, `tan`, `cot`, and all other trigonometric functions are **not** part of this library's public API (FR-007).

---

## Not Exported

The following are explicitly **absent** from the public API surface:

| Symbol | Reason |
|---|---|
| `cos` | Out of scope (FR-007) |
| `tan` | Out of scope (FR-007) |
| `cot` | Out of scope (FR-007) |
| `assertNumber` | Internal guard — implementation detail |
| Default export | Not used; named exports only |

---

## Error Reference

| Error Class | When | Message |
|---|---|---|
| `TypeError` | Non-number argument | `Argument '<param>' must be a valid number; received <type>.` |
| `TypeError` | `NaN` argument | `Argument '<param>' must be a valid number; received NaN.` |
| `Error` | `divide(a, 0)` | `Division by zero: divisor must not be 0.` |

---

## Behavioural Guarantees

| Guarantee | Specification reference |
|---|---|
| Stateless — no side effects between calls | FR-009, SC-006 |
| Accepts any IEEE 754 float64 value except NaN | FR-010 |
| Returns `Infinity`/`-Infinity` for out-of-range results | FR-011 |
| `sin` delegates to `Math.sin`; precision ≤ 10 d.p. | SC-002 |
| Each call completes in < 1 ms | SC-004 |
| No trigonometric functions other than `sin` exported | FR-007, SC-005 |

---

## Versioning Policy

This contract is **v1.0.0**. Any change to function names, parameter types, return types, or thrown error types is a **breaking change** and requires a new major version. Additive exports (new functions) are minor changes.
