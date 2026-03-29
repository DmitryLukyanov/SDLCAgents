# Data Model: Simple Calculator (TC-5)

**Phase**: 1 — Design & Contracts  
**Branch**: `001-simple-calculator`  
**Date**: 2026-03-29  

---

## Module Identity

| Property | Value |
|----------|-------|
| File | `src/lib/calculator.ts` |
| Module type | ESM (`"type": "module"`, NodeNext resolution) |
| Export style | Named exports only — no default export |
| Side effects | None — pure functions, no I/O, no state |
| Dependencies | None (uses only built-in `Math.*`) |

---

## Exported Functions

### `add(a: number, b: number): number`

| Property | Detail |
|----------|--------|
| Parameters | `a`, `b` — both validated numeric inputs |
| Returns | `a + b`, rounded to 4 dp if non-integer |
| Throws | `TypeError` if either argument is non-numeric/NaN/null/undefined |
| Throws | `RangeError` if either argument is non-finite or exceeds `±MAX_SAFE_INTEGER` |

---

### `subtract(a: number, b: number): number`

| Property | Detail |
|----------|--------|
| Parameters | `a`, `b` — both validated numeric inputs |
| Returns | `a - b`, rounded to 4 dp if non-integer |
| Throws | `TypeError` if either argument is non-numeric/NaN/null/undefined |
| Throws | `RangeError` if either argument is non-finite or exceeds `±MAX_SAFE_INTEGER` |

---

### `multiply(a: number, b: number): number`

| Property | Detail |
|----------|--------|
| Parameters | `a`, `b` — both validated numeric inputs |
| Returns | `a * b`, rounded to 4 dp if non-integer |
| Throws | `TypeError` if either argument is non-numeric/NaN/null/undefined |
| Throws | `RangeError` if either argument is non-finite or exceeds `±MAX_SAFE_INTEGER` |

---

### `divide(a: number, b: number): number`

| Property | Detail |
|----------|--------|
| Parameters | `a` (dividend), `b` (divisor) — both validated numeric inputs |
| Returns | `a / b`, rounded to 4 dp if non-integer |
| Throws | `TypeError` if either argument is non-numeric/NaN/null/undefined |
| Throws | `RangeError` if either argument is non-finite or exceeds `±MAX_SAFE_INTEGER` |
| Throws | `Error("Cannot divide by zero")` if `b === 0` (checked after type/range validation) |

---

### `sinDeg(x: number): number`

| Property | Detail |
|----------|--------|
| Parameters | `x` — angle in **degrees**, validated numeric input |
| Returns | `Math.sin(x * π/180)`, rounded to 4 dp if non-integer |
| Conversion | Degrees → radians: `x * (Math.PI / 180)` |
| Throws | `TypeError` if argument is non-numeric/NaN/null/undefined |
| Throws | `RangeError` if argument is non-finite or exceeds `±MAX_SAFE_INTEGER` |
| Note | `sinDeg(180)` floating-point artifact (~`1.2e-16`) resolves to `0` after rounding |

---

## Private Helper

### `assertNumber(x: unknown, argName: string): asserts x is number`

Not exported. Applied to every argument before any computation.

**Validation sequence** (order matters):

1. `typeof x !== 'number' || isNaN(x as number)` → `throw new TypeError(`Invalid input: expected a finite number for '${argName}', got ${typeof x}`)`  
2. `!isFinite(x as number) || Math.abs(x as number) > Number.MAX_SAFE_INTEGER` → `throw new RangeError("Input exceeds supported numeric range")`

**Design note**: Step 1 uses `isNaN` (not `Number.isNaN`) because `typeof x !== 'number'` already guards against non-number types; `isNaN` is therefore safe here and catches the `NaN` case when `typeof x === 'number'`.

---

## Result Rounding

### `formatResult(value: number): number`

Not exported. Applied to every computed result before return.

```
parseFloat(value.toFixed(4))
```

| Input | `toFixed(4)` | `parseFloat` | Returns |
|-------|-------------|--------------|---------|
| `13` | `"13.0000"` | `13` | `13` |
| `0.5` | `"0.5000"` | `0.5` | `0.5` |
| `0.33333…` | `"0.3333"` | `0.3333` | `0.3333` |
| `1` (sin 90°) | `"1.0000"` | `1` | `1` |

---

## Error Taxonomy

| Error type | Message | Trigger |
|------------|---------|---------|
| `TypeError` | `"Invalid input: expected a finite number for '<argName>', got <typeof>"` | Non-number, NaN, null, undefined argument |
| `RangeError` | `"Input exceeds supported numeric range"` | Infinity, -Infinity, or `\|x\| > MAX_SAFE_INTEGER` |
| `Error` | `"Cannot divide by zero"` | `divide(a, 0)` after validation passes |

---

## State & Lifecycle

- **No state**: The module is entirely stateless. No caches, registries, or module-level mutable variables.
- **No async**: All functions are synchronous; no `Promise`, no I/O.
- **No side effects**: No console output, no file writes, no environment reads.

---

## Scope Boundary (Out of Scope)

| Item | Status |
|------|--------|
| `cos`, `tan`, `cot`, and other trig functions | **Explicitly excluded** (FR-006) |
| Expression-string parsing (`"8 + 5"`) | **Explicitly excluded** (FR-011) |
| Chained operations (`2 + 3 * 4`) | **Explicitly excluded** |
| Calculation history / persistent state | **Explicitly excluded** |
| CLI or REPL interface | **Explicitly excluded** |
| Radians input for `sinDeg` | **Explicitly excluded** |
