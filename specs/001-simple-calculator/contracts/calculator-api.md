# API Contract: Calculator Module (TC-5)

**Module**: `src/calculator/index.ts`  
**Export style**: ESM named exports  
**Module resolution**: NodeNext (`.js` extensions required in import paths)  
**Branch**: `001-simple-calculator`

---

## Import

```typescript
import { add, subtract, multiply, divide, sin } from './src/calculator/index.js';
```

---

## Function Signatures

### `add(a, b)`

```typescript
export function add(a: number, b: number): number
```

Returns the sum `a + b`.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `a` | `number` | ✅ | Any IEEE 754 double |
| `b` | `number` | ✅ | Any IEEE 754 double |

**Returns**: `number` — `a + b`  
**Throws**: `Error` if `typeof a !== 'number'` or `typeof b !== 'number'`

---

### `subtract(a, b)`

```typescript
export function subtract(a: number, b: number): number
```

Returns the difference `a - b`.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `a` | `number` | ✅ | Any IEEE 754 double |
| `b` | `number` | ✅ | Any IEEE 754 double |

**Returns**: `number` — `a - b`  
**Throws**: `Error` if `typeof a !== 'number'` or `typeof b !== 'number'`

---

### `multiply(a, b)`

```typescript
export function multiply(a: number, b: number): number
```

Returns the product `a * b`.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `a` | `number` | ✅ | Any IEEE 754 double |
| `b` | `number` | ✅ | Any IEEE 754 double |

**Returns**: `number` — `a * b`  
**Throws**: `Error` if `typeof a !== 'number'` or `typeof b !== 'number'`

---

### `divide(a, b)`

```typescript
export function divide(a: number, b: number): number
```

Returns the quotient `a / b`. Division by zero is explicitly forbidden.

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `a` | `number` | ✅ | Any IEEE 754 double |
| `b` | `number` | ✅ | Must not be `0` |

**Returns**: `number` — `a / b`  
**Throws**:
- `Error('Division by zero')` — when `b === 0`
- `Error('Argument "a" must be a number, got ...')` — when `typeof a !== 'number'`
- `Error('Argument "b" must be a number, got ...')` — when `typeof b !== 'number'`

> ⚠️ `divide` does **not** return `Infinity` for `a / 0`. It always throws. This overrides default JavaScript behaviour.

---

### `sin(x)`

```typescript
export function sin(x: number): number
```

Returns the sine of `x` (angle in **radians**).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `x` | `number` | ✅ | Angle in radians; any IEEE 754 double including `Infinity` |

**Returns**: `number` — `Math.sin(x)`, in range `[-1, 1]` for finite inputs. Returns `NaN` for non-finite inputs (e.g. `Infinity`) — this is a valid mathematical outcome, not an error.  
**Throws**: `Error` if `typeof x !== 'number'`

> ℹ️ Only `sin` is exposed. `cos`, `tan`, `cot`, and all other trigonometric functions are **out of scope** (FR-007). Requests for them must be made via a new Jira issue.

---

## Error Contract

All errors are standard JavaScript `Error` objects thrown synchronously.

| Code path | Error message |
|-----------|---------------|
| Non-numeric `a` | `Argument "a" must be a number, got <typeof a>` |
| Non-numeric `b` | `Argument "b" must be a number, got <typeof b>` |
| Non-numeric `x` | `Argument "x" must be a number, got <typeof x>` |
| Division by zero | `Division by zero` |

Callers catch errors with standard `try/catch`:

```typescript
try {
  const result = divide(10, 0);
} catch (err) {
  // err is an Error object
  console.error((err as Error).message); // 'Division by zero'
}
```

---

## Explicitly Out-of-Scope

The following are **not** part of this module's contract:

| Item | Reason |
|------|--------|
| `cos`, `tan`, `cot` | FR-007: only `sin` in TC-5 |
| Expression string parsing (`"3 + sin(x)"`) | Out of scope per spec Assumptions |
| Degree-to-radian conversion | Caller responsibility |
| Multi-operand chaining (`add(1, 2, 3)`) | Out of scope per spec Assumptions |
| Memory / history | Stateless module — no history |
| `NaN` input rejection | `typeof NaN === 'number'` — passes type guard, propagates per IEEE 754 |

---

## Versioning

This contract covers **TC-5 v1.0**. Any addition of functions (including `cos`, `tan`) constitutes a new Jira issue and a new contract revision.
