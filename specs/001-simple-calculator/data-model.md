# Data Model: Simple Calculator (TC-5)

**Branch**: `001-simple-calculator` | **Phase**: 1 — Design

---

## Entities

### `Operation` (string union — discriminated by operation type)

The operation is the sole entity; it fully describes one calculator invocation.

```typescript
type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide';
type UnaryOperation  = 'sin';
type Operation       = BinaryOperation | UnaryOperation;
```

No persistent state is maintained between invocations — the calculator is fully stateless.

---

### `CalcInput`

Parsed and validated representation of a single CLI invocation's arguments.

| Field       | Type              | Source            | Constraint                          |
|-------------|-------------------|-------------------|--------------------------------------|
| `operation` | `Operation`       | `argv[0]`         | One of the five supported keywords  |
| `operands`  | `[number]` or `[number, number]` | `argv[1], argv[2]` | 1 operand for `sin`; 2 for arithmetic |

Validation rules (applied at parse time):
- `operation` must be one of `add`, `subtract`, `multiply`, `divide`, `sin`.
- Each operand string must be parseable as a finite `number` (`Number(s)` must not return `NaN`).
- `divide` with a second operand of `0` is a domain error (caught post-parse).
- Supplying the wrong number of operands for the operation is a validation error.

---

### `CalcResult` (discriminated union)

```typescript
type CalcResult =
  | { ok: true;  value: number }
  | { ok: false; error: string };
```

| Field   | Type     | Meaning                                      |
|---------|----------|----------------------------------------------|
| `ok`    | boolean  | `true` → successful calculation              |
| `value` | number   | The computed result (present when `ok: true`) |
| `error` | string   | Human-readable error message (`ok: false`)   |

---

## State Transitions

```
CLI argv
   │
   ▼
parseArgs()
   ├── invalid operation  →  { ok: false, error: "Unsupported operation: …" }
   ├── wrong operand count →  { ok: false, error: "… requires N operand(s)" }
   ├── non-numeric operand →  { ok: false, error: "Invalid input: … is not a number" }
   └── valid CalcInput
          │
          ▼
       calculate()
          ├── divide by zero  →  { ok: false, error: "Division by zero" }
          └── result          →  { ok: true,  value: <number> }
```

---

## Validation Rules

| Rule | Condition | Error message |
|------|-----------|---------------|
| Unsupported operation | `operation` not in allowed set | `Unsupported operation: "<op>". Supported: add, subtract, multiply, divide, sin` |
| Wrong operand count (binary) | `add|subtract|multiply|divide` with ≠ 2 operands | `"<op>" requires 2 numeric operands` |
| Wrong operand count (unary) | `sin` with ≠ 1 operand | `"sin" requires 1 numeric operand` |
| Non-numeric input | `Number(arg)` is `NaN` | `Invalid input: "<arg>" is not a number` |
| Division by zero | `divide` with second operand `0` | `Division by zero` |

---

## Numeric Behaviour (documented, not an error)

| Input condition | Behaviour |
|-----------------|-----------|
| Result exceeds `Number.MAX_VALUE` | Returns `Infinity` (surfaced as output, not error) |
| Very small result (`< Number.MIN_VALUE` magnitude) | Returns `0` or `-0` |
| `sin` of any finite number | Delegates to `Math.sin()`; precision ≥ 6 significant figures |
