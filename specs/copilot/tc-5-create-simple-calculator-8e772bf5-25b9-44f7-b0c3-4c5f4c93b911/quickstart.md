# Quickstart: Simple Calculator

**Feature**: TC-5 Simple Calculator  
**Date**: 2026-03-29

---

## Prerequisites

- **Node.js** ≥ 20 (check: `node --version`)
- **npm** (bundled with Node.js)
- Repository cloned and dependencies installed:
  ```bash
  npm install
  ```

---

## Run the REPL

```bash
npm run calculator
```

The REPL starts immediately:

```
Calculator REPL — type "exit" to quit
> 
```

**Supported expressions**:

| Expression | Result |
|------------|--------|
| `5 + 3` | `8` |
| `10 - 4` | `6` |
| `6 * 7` | `42` |
| `15 / 3` | `5` |
| `1 / 3` | `0.3333333333` |
| `sin(0)` | `0` |
| `sin(30)` | `0.5` |
| `sin(90)` | `1` |
| `sin(-90)` | `-1` |

Type `exit` or `quit` to end the session.

---

## Use as a Library

Import `calculate` and `formatNumber` in any TypeScript file within the project:

```typescript
import { calculate, formatNumber } from './src/calculator/index.ts';

const result = calculate('sin(30)');

if (result.kind === 'success') {
  console.log(formatNumber(result.value)); // "0.5"
} else {
  console.error(result.message);
}
```

**Key functions**:

| Export | Signature | Description |
|--------|-----------|-------------|
| `calculate` | `(expression: string) => CalculatorResult` | Parse + evaluate; never throws |
| `formatNumber` | `(value: number) => string` | Format a number per FR-009 rules |

See [`contracts/library-api.md`](./contracts/library-api.md) for the full type contract.

---

## Run Tests

```bash
npm run test:calculator
```

Expected output (all passing):

```
▶ parser
  ✔ parses binary addition (0.123ms)
  ✔ parses binary subtraction (0.045ms)
  ✔ parses binary multiplication (0.044ms)
  ✔ parses binary division (0.042ms)
  ✔ parses sin(degrees) (0.041ms)
  ✔ rejects blank input (0.043ms)
  ✔ rejects unsupported operation cos (0.041ms)
  ✔ rejects incomplete expression (0.042ms)
▶ calculator
  ✔ 5 + 3 = 8 (0.041ms)
  ✔ 7 / 0 returns error (0.040ms)
  ✔ sin(30) ≈ 0.5 (0.041ms)
  ✔ sin(90) = 1 (0.040ms)
  ✔ sin(-90) = -1 (0.040ms)
▶ formatter
  ✔ formats integers without decimal (0.040ms)
  ✔ formats 1/3 to 10 sig figs (0.040ms)
  ✔ formats Infinity as range error (0.040ms)
▶ repl integration
  ✔ full expression pipeline (0.040ms)
```

---

## Type-check Only

```bash
npm run check
```

No new compiler flags are needed; the existing `tsconfig.json` covers `src/**/*.ts` and `tests/**/*.ts`.

---

## File Map

```
src/calculator/
├── types.ts          — Operation enum, ParsedExpression, CalculatorResult types
├── parser.ts         — parse(input: string): ParseResult
├── calculator.ts     — calculate(expression: string): CalculatorResult
├── formatter.ts      — formatNumber(value: number): string
├── index.ts          — public library re-exports
└── cli.ts            — interactive REPL (not part of library API)

tests/calculator/
├── unit/
│   ├── parser.test.ts
│   ├── calculator.test.ts
│   └── formatter.test.ts
└── integration/
    └── repl.test.ts
```

---

## Common Errors

| Message | Cause | Fix |
|---------|-------|-----|
| `Please enter a valid expression.` | Empty or blank input | Type a valid expression |
| `Unsupported operation. Supported: +, -, *, /, sin.` | Used `cos`, `tan`, `%`, etc. | Use only `+`, `-`, `*`, `/`, or `sin()` |
| `Incomplete expression. Expected: <number> <+\|-\|*\/> <number>.` | Missing second operand | Provide both operands: `5 + 3` |
| `Division by zero is not allowed.` | Right operand is `0` with `/` | Use a non-zero divisor |
| `Result is out of numeric range.` | Computation overflowed IEEE 754 | Use smaller operands |

---

## Design Decisions

For rationale behind technology choices (test runner, regex patterns, formatting strategy, module layout), see [`research.md`](./research.md).

For entity types and validation rules, see [`data-model.md`](./data-model.md).
