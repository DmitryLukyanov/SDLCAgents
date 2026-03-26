# CLI Contract: `calc`

**Branch**: `001-simple-calculator` | **Phase**: 1 — Design

This document is the authoritative contract for the `calc` command-line interface. It defines invocation syntax, outputs, exit codes, and error cases. Implementations and tests must conform to this contract.

---

## Invocation

```
calc <operation> [operands...]
```

Invoked via:

```bash
npx tsx src/calculator/cli.ts <operation> [operands...]
```

---

## Supported Operations

| Operation    | Syntax                      | Operand count | Description                      |
|--------------|-----------------------------|---------------|----------------------------------|
| `add`        | `calc add <a> <b>`          | 2             | Returns `a + b`                  |
| `subtract`   | `calc subtract <a> <b>`     | 2             | Returns `a - b`                  |
| `multiply`   | `calc multiply <a> <b>`     | 2             | Returns `a * b`                  |
| `divide`     | `calc divide <a> <b>`       | 2             | Returns `a / b` (b ≠ 0)         |
| `sin`        | `calc sin <a>`              | 1             | Returns `Math.sin(a)` (radians)  |

---

## Success Output

On success, the calculator prints the numeric result to **stdout**, followed by a newline, and exits with code **0**.

```
<result>\n
```

Examples:

```bash
$ calc add 3 5
8

$ calc multiply 2.5 4
10

$ calc sin 0
0

$ calc divide 10 4
2.5
```

---

## Error Output

On error, the calculator prints a human-readable message to **stderr**, nothing to stdout, and exits with code **1**.

```
Error: <message>\n
```

### Error Cases

| Trigger | stderr message | Exit code |
|---------|----------------|-----------|
| Unknown operation (e.g. `calc cos 1`) | `Error: Unsupported operation: "cos". Supported: add, subtract, multiply, divide, sin` | 1 |
| Missing operand (e.g. `calc add 3`) | `Error: "add" requires 2 numeric operands` | 1 |
| Extra operand (e.g. `calc sin 1 2`) | `Error: "sin" requires 1 numeric operand` | 1 |
| Non-numeric operand (e.g. `calc add abc 3`) | `Error: Invalid input: "abc" is not a number` | 1 |
| Division by zero (`calc divide 5 0`) | `Error: Division by zero` | 1 |
| No arguments (`calc`) | `Error: Usage: calc <operation> [operands...]` | 1 |

---

## Explicitly Unsupported Operations

The following operations are **in-scope rejections** (must return a clear error, not crash):

- `cos`, `tan`, `cot` — rejected with "unsupported operation" message

---

## Numeric Precision

- Results follow standard IEEE 754 double-precision arithmetic.
- `sin` results match `Math.sin()` to at least 6 significant figures.
- `Infinity` may appear as output for overflow results (e.g. `calc divide 1e308 1e-308`); this is defined behaviour.

---

## Out of Scope

- Degree input for `sin` — only radians supported
- Compound/chained expressions — one operation per invocation only
- Persistent history
- Interactive (REPL) mode
