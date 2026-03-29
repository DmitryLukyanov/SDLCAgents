# Quickstart: Simple Calculator

**Feature**: Simple Calculator CLI REPL
**Date**: 2026-03-29

---

## Prerequisites

- Node.js ≥ 20 (already required by the repo)
- Dependencies installed: `npm install` from the repo root (dev toolchain only)

---

## Running the Calculator

```bash
npm run calculator
```

Or directly with tsx:

```bash
tsx src/calculator/index.ts
```

You will see the `> ` prompt. Type expressions and press Enter.

```
> 10 + 5
15
> 2 + 3 * 4
14
> (2 + 3) * 4
20
> sin(90)
1
> 1 / 3
0.3333333333
> -5 + 3
-2
> 3 * -2
-6
> 5 / 0
Error: Division by zero
> exit
```

Press **Ctrl+C** or type **`exit`** / **`quit`** to leave.

---

## Running the Tests

```bash
node --test tests/calculator/
```

Expected output (all green):

```
▶ Lexer
  ✔ tokenises integer literals
  ✔ tokenises decimal literals
  ✔ tokenises all operator characters
  ✔ tokenises sin identifier
  ✔ skips whitespace
  ✔ throws on unknown character
▶ Parser / Evaluator
  ✔ addition
  ✔ subtraction
  ✔ multiplication
  ✔ division
  ✔ operator precedence: 2 + 3 * 4 = 14
  ✔ parentheses: (2 + 3) * 4 = 20
  ✔ unary minus: -5 + 3 = -2
  ✔ unary minus in sub-expression: 3 * -2 = -6
  ✔ sin(0) = 0
  ✔ sin(90) = 1
  ✔ sin(180) within tolerance
  ✔ sin embedded: 10 + sin(30) * 2 = 11
  ✔ division by zero throws
  ✔ unknown function throws
  ✔ missing closing paren throws
  ✔ 10 significant digits: 1/3 = 0.3333333333
▶ REPL
  ✔ empty line re-prompts silently
  ✔ exit command exits with code 0
  ✔ quit command exits with code 0
  ✔ error does not crash the REPL
```

---

## Type-Check Only

```bash
npm run check
```

Must produce no errors.

---

## Project Layout (this feature)

```
src/calculator/
├── index.ts        ← entry point (npm run calculator)
├── repl.ts         ← readline REPL loop
├── lexer.ts        ← tokeniser
├── parser.ts       ← recursive-descent parser + evaluator
└── formatter.ts    ← number → 10-sig-digit string

tests/calculator/
├── lexer.test.ts
├── parser.test.ts
└── repl.test.ts
```

---

## Expression Syntax Reference

| Syntax | Example | Result |
|---|---|---|
| Addition | `3 + 4` | `7` |
| Subtraction | `10 - 6` | `4` |
| Multiplication | `6 * 7` | `42` |
| Division | `20 / 4` | `5` |
| Parentheses | `(2 + 3) * 4` | `20` |
| Unary minus | `-5 + 3` | `-2` |
| Mixed unary | `3 * -2` | `-6` |
| Sine (degrees) | `sin(90)` | `1` |
| Sine in expression | `10 + sin(30) * 2` | `11` |
| Nested parens | `(1 + (2 * 3))` | `7` |

## Known Limitations

- Only `sin` is available. `cos`, `tan`, `cot` are intentionally unsupported.
- Arguments are real numbers only (no complex numbers).
- No calculation history or session persistence.
- Radians mode is not supported; `sin` always takes degrees.
