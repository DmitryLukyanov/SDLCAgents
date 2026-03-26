# Data Model: Simple Calculator (TC-5)

**Feature**: TC-5 — Simple Calculator
**Phase**: 1 — Design
**Date**: 2025-07-18

---

## Entities

### `Operator`

The set of all supported operation identifiers.

```typescript
type BinaryOperator = '+' | '-' | '*' | '/';
type UnaryOperator = 'sin';
type Operator = BinaryOperator | UnaryOperator;
```

**Constraints**:
- Only the five values above are valid (FR-003: `cos`, `tan`, `cot` are explicitly excluded).
- Any other string is an unsupported operator (FR-008).

---

### `BinaryOperation`

A computation request consisting of a binary operator and two numeric operands.

| Field | Type | Description |
|---|---|---|
| `op` | `BinaryOperator` | The arithmetic operator: `+`, `-`, `*`, or `/` |
| `left` | `number` | Left-hand operand (any finite JavaScript number) |
| `right` | `number` | Right-hand operand (any finite JavaScript number) |

**Validation rules**:
- `left` and `right` must be finite numbers (`Number.isFinite(n) === true`). Non-finite values (NaN, Infinity) are rejected at the CLI parsing layer before the library is called.
- For `divide`: `right` must not be `0`. The library enforces this and throws (FR-006, FR-009).
- For `add`, `subtract`, `multiply`: no additional operand constraints.

**State transitions**: None — operations are stateless. Each invocation produces exactly one `Result` or throws an `Error`.

---

### `UnaryOperation`

A computation request consisting of the `sin` operator and one numeric operand.

| Field | Type | Description |
|---|---|---|
| `op` | `'sin'` | Always the literal string `'sin'` |
| `operand` | `number` | The angle in radians (any finite JavaScript number) |

**Validation rules**:
- `operand` must be a finite number. Non-finite values are rejected at CLI parse time.
- No range restrictions — any real number is a valid radian value (FR-002).
- Very large numbers are accepted; `Math.sin` handles them without crashing (SC-002, edge case).

---

### `Result`

The numeric outcome of a successful operation.

| Field | Type | Description |
|---|---|---|
| value | `number` | The computed result (always a finite JavaScript number) |

**Formatting rule** (FR-010):
```
displayString = parseFloat(value.toFixed(10)).toString()
```
Examples: `5` → `"5"`, `1/3` → `"0.3333333333"`, `1/4` → `"0.25"`.

---

### `CalculatorError`

A JavaScript `Error` instance thrown by the library for invalid operations (FR-009).

| Condition | Message |
|---|---|
| Division by zero | `"Division by zero is not allowed"` |

The library does **not** throw for non-numeric input (that is the CLI's responsibility). The library trusts its callers to pass valid numbers.

---

## Relationships

```
CLI args ──[parseArg]──► BinaryOperation │
                                          ├──► Calculator library ──► Result
CLI args ──[parseArg]──► UnaryOperation  │
                                    │
                                    └──► CalculatorError (thrown)
```

- The CLI layer transforms raw `string[]` argv into typed operation objects.
- The library layer applies the operation and returns a `number`.
- The formatting layer converts the `number` to a display string.
- Error propagation: library throws → CLI catches → prints to stderr → exits 1.

---

## Input/Output Contract Summary

| Scenario | Library call | Return | Throws |
|---|---|---|---|
| `2 + 3` | `add(2, 3)` | `5` | — |
| `10 - 7` | `subtract(10, 7)` | `3` | — |
| `4 * 2.5` | `multiply(4, 2.5)` | `10` | — |
| `1 / 3` | `divide(1, 3)` | `0.333…` | — |
| `1 / 0` | `divide(1, 0)` | — | `Error("Division by zero is not allowed")` |
| `sin(0)` | `sin(0)` | `0` | — |
| `sin(π/2)` | `sin(1.5707963…)` | `≈1` | — |
| `sin(-π/2)` | `sin(-1.5707963…)` | `≈-1` | — |
