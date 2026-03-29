# Data Model: Simple Calculator

**Phase**: 1 — Design & Contracts
**Date**: 2026-03-29
**Feature**: Simple Calculator CLI REPL

This document describes the data structures, grammar, and evaluation model used internally by the
calculator. There are no persistent entities (no database, no files); all state is transient within
a single expression evaluation.

---

## 1. Token Model

The **Lexer** converts a raw input string into a flat list of `Token` objects.

### `TokenType` Enum

```typescript
enum TokenType {
  NUMBER,    // Floating-point literal: e.g. 42, 3.14, .5
  IDENT,     // Identifier: currently only 'sin' is valid
  PLUS,      // +
  MINUS,     // -
  STAR,      // *
  SLASH,     // /
  LPAREN,    // (
  RPAREN,    // )
  EOF,       // Sentinel: end of input
}
```

### `Token` Type

```typescript
type Token = {
  type: TokenType;
  value: string;   // Raw text slice from the source string
};
```

**Examples**:

| Source text | Token stream |
|---|---|
| `10 + 5` | `NUMBER("10")`, `PLUS("+")`, `NUMBER("5")`, `EOF` |
| `sin(90)` | `IDENT("sin")`, `LPAREN("(")`, `NUMBER("90")`, `RPAREN(")")`, `EOF` |
| `-5 + 3` | `MINUS("-")`, `NUMBER("5")`, `PLUS("+")`, `NUMBER("3")`, `EOF` |
| `(2+3)*4` | `LPAREN`, `NUMBER("2")`, `PLUS`, `NUMBER("3")`, `RPAREN`, `STAR`, `NUMBER("4")`, `EOF` |

### Lexer Rules (priority order)

1. **Whitespace** (space, tab, newline) — skipped silently
2. **NUMBER** — regex `/\d+(\.\d*)?|\.\d+/` (integers, decimals, leading-dot decimals)
3. **IDENT** — regex `/[a-zA-Z_][a-zA-Z0-9_]*/` (letters + digits + underscore)
4. **Single-character operators** — `+`, `-`, `*`, `/`, `(`, `)`
5. **Unknown character** → throws `Error: Unexpected character '<ch>'`

---

## 2. Grammar (EBNF)

The **Parser** implements the following grammar. Each production corresponds directly to a private
method in the `Parser` class.

```ebnf
expression  ::= term ( ( '+' | '-' ) term )*
term        ::= unary ( ( '*' | '/' ) unary )*
unary       ::= '-' unary
              | primary
primary     ::= NUMBER
              | 'sin' '(' expression ')'
              | '(' expression ')'
```

### Precedence Table (high to low)

| Precedence | Operator(s) | Associativity | Grammar Rule |
|---|---|---|---|
| 4 (highest) | Unary `-` | Right | `unary` |
| 3 | `*`, `/` | Left | `term` |
| 2 | `+`, `-` | Left | `expression` |
| 1 (lowest) | Grouping `()` | — | `primary` |

### Resolved Ambiguities

| Expression | Parse tree | Result |
|---|---|---|
| `2 + 3 * 4` | `2 + (3 * 4)` | `14` |
| `(2 + 3) * 4` | `(2 + 3) * 4` | `20` |
| `-5 + 3` | `(-5) + 3` | `-2` |
| `3 * -2` | `3 * (-2)` | `-6` |
| `10 + sin(30) * 2` | `10 + (sin(30) * 2)` | `11` |

---

## 3. Evaluation Model

Evaluation is **inline** (no separate AST). Each grammar production function returns a `number`.

### `evaluate(source: string): number`

Top-level API exposed by `parser.ts`:

1. Call `new Lexer(source).tokenise()` → `Token[]`
2. Call `new Parser(tokens).parse()` → calls `expression()`
3. After `expression()` returns, assert next token is `EOF`; if not, throw `Error: Unexpected token`
4. Return the number

### Function Application — `sin`

```
primary  ::= 'sin' '(' expression ')'
```

Evaluation:
```
angleRadians = evaluatedInnerExpression * Math.PI / 180
result       = Math.sin(angleRadians)
```

Only `sin` is a valid IDENT. Any other identifier (e.g., `cos`, `tan`) throws
`Error: Unknown function '<name>'`.

### Division by Zero

Detected in the `term` production when a `/` operator is encountered:
```typescript
if (right === 0) throw new Error('Division by zero');
result = result / right;   // Only reached if right !== 0
```

JavaScript's native `/` would otherwise produce `Infinity` silently.

---

## 4. Number Formatting Model

Defined in `formatter.ts` as a pure function:

```typescript
function format(n: number): string
```

### Rules

1. If `!isFinite(n)` → return `String(n)` (handles `Infinity`, `-Infinity`, `NaN`)
2. Otherwise → `parseFloat(n.toPrecision(10)).toString()`

### Guarantees

- Integer-valued results display without decimal point (`42`, not `42.0`)
- Non-integer results display up to 10 significant digits (`0.3333333333`)
- Very small near-zero results display in exponential notation (`1.224646799e-16`)
- Exact powers of 10 display correctly (`1000`, not `1.000000000e+3`)

---

## 5. REPL State Machine

The REPL has no persistent mutable state between evaluations. The only runtime state is:

| State field | Type | Lifetime | Purpose |
|---|---|---|---|
| `rl` | `readline.Interface` | Process lifetime | Manages stdin/stdout |
| Current line (transient) | `string` | Single REPL cycle | Input from user |
| Evaluation result (transient) | `number` | Single REPL cycle | Value to format and print |
| Error (transient) | `Error \| null` | Single REPL cycle | Caught and printed, then discarded |

### State Transitions

```
WAITING_FOR_INPUT  ──(enter)──►  EVALUATING
EVALUATING         ──(success)─► PRINTING_RESULT ──► WAITING_FOR_INPUT
EVALUATING         ──(error)───► PRINTING_ERROR  ──► WAITING_FOR_INPUT
EVALUATING         ──(exit cmd)► EXIT
WAITING_FOR_INPUT  ──(SIGINT)──► EXIT
```
