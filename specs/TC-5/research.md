# Research: Simple Calculator (TC-5)

**Feature**: TC-5 — Simple Calculator
**Phase**: 0 — Research
**Date**: 2025-07-18

All design questions for TC-5 were resolved during the spec clarification session (2026-03-26). This document records the research findings that confirm those decisions are correct within the project's specific toolchain.

---

## Finding 1: node:test with ESM and tsx

**Question**: Is `node:test` fully usable with this project's ESM + NodeNext + tsx toolchain?

**Decision**: Use `node:test` with `import { test, describe } from 'node:test'` and `node:assert/strict`.

**Rationale**:
- `node:test` was stabilised in Node.js 18 and is fully available in Node.js 20+. The project's `engines` field already requires Node ≥ 20.
- ESM imports work natively: `import { test, describe } from 'node:test'` and `import assert from 'node:assert/strict'`.
- `tsx` (already a devDependency) supports `--import tsx/esm` as a Node.js loader, enabling TypeScript test files to run without a compile step.
- Run command: `node --import tsx/esm --test tests/calculator/calculator.test.ts`

**Alternatives considered**:
- **Vitest**: Adds a devDependency (rejected per spec Q5).
- **Jest**: ESM support requires extra configuration; adds dependencies (rejected).
- **ts-mocha / tap**: Both add dependencies (rejected).

---

## Finding 2: Output formatting — trailing-zero trimming

**Question**: What is the simplest correct implementation of "max 10 decimal places, trailing zeros trimmed, no decimal point for integers"?

**Decision**: `parseFloat(n.toFixed(10)).toString()`

**Rationale**:
`toFixed(10)` produces exactly 10 decimal places, then `parseFloat` converts the string back to a number (removing trailing zeros), and `.toString()` renders it without unnecessary decimals.

Verification against spec examples:

| Expression | `n` | `n.toFixed(10)` | `parseFloat(…)` | `.toString()` |
|---|---|---|---|---|
| `2 + 3` | `5` | `"5.0000000000"` | `5` | `"5"` ✅ |
| `1 / 3` | `0.333…` | `"0.3333333333"` | `0.3333333333` | `"0.3333333333"` ✅ |
| `1 / 4` | `0.25` | `"0.2500000000"` | `0.25` | `"0.25"` ✅ |
| `Math.sin(0)` | `0` | `"0.0000000000"` | `0` | `"0"` ✅ |

**Alternatives considered**:
- `n.toPrecision(10)`: Changes number of significant figures, not decimal places — incorrect for integers.
- Custom regex strip: More code, same result.
- `Intl.NumberFormat`: Locale-dependent, not appropriate for deterministic output.

---

## Finding 3: Negative number CLI arguments

**Question**: How should the CLI handle `-5` as an operand without special quoting?

**Decision**: Use `Number(token)` for numeric parsing — do not use any option-parsing library.

**Rationale**:
Node.js populates `process.argv` with raw strings exactly as typed. The shell passes `-5` through unchanged (it only strips quoting, not leading hyphens on operands). Therefore `process.argv.slice(2)` contains `['-5', '+', '3']` for `calc -5 + 3` — no special handling is needed provided we do not use an option parser.

`Number('-5')` → `-5`, `Number.isFinite(-5)` → `true`. The token is accepted as a number.
`Number('-')` → `NaN`, `Number.isFinite(NaN)` → `false`. The bare hyphen used as the subtraction operator is correctly rejected as a number (it is matched as an operator instead).

**Alternatives considered**:
- Using `--` separator (e.g., `calc -- -5 + 3`): Requires special syntax, violating FR-011.
- `parseInt` / `parseFloat`: Both accept partial strings (e.g., `parseFloat('5abc')` → `5`), making them unsuitable for strict validation. `Number(token)` rejects any non-numeric string.

---

## Finding 4: Math.sin for trigonometric computation

**Question**: Should `sin` use `Math.sin` or an external library?

**Decision**: Use `Math.sin(x)` directly.

**Rationale**:
- `Math.sin` in V8/Node.js is IEEE 754 double-precision, accurate to ~15 significant digits.
- With output capped at 10 decimal places, any floating-point rounding beyond the 10th place is invisible to the user.
- No external dependency is needed or justified (zero-dependency requirement per spec Q5).
- The spec does not require a particular precision beyond "correct" — `Math.sin(Math.PI / 2)` ≈ `0.9999999999999999`, which rounds to `1` at 10 d.p.

**Alternatives considered**:
- `mathjs`: Adds a dependency; overkill for a single function.
- Arbitrary-precision libraries (`decimal.js`): Not required by spec; adds dependency.

---

## Finding 5: Import path conventions (NodeNext resolution)

**Question**: What import path extension is required for intra-project imports?

**Decision**: Always use `.js` extension in import paths within TypeScript source files.

**Rationale**:
`"module": "NodeNext"` in `tsconfig.json` uses the Node.js native ESM resolution algorithm, which does not perform extension inference. TypeScript compiles `.ts` source files but leaves import paths unchanged — so imports must already reference `.js` (the runtime filename). This is confirmed by every existing file in the project (e.g., `import { runDummyTicketAgent } from './dummy-agent.js'`).

The calculator CLI and library follow this pattern:
```typescript
// In calculator-cli.ts:
import { add, subtract, multiply, divide, sin as calcSin } from './calculator.js';
```

**Alternatives considered**:
- `.ts` extension: Rejected by Node.js at runtime unless `--experimental-strip-types` is used (not the project pattern).
- No extension: Fails Node.js ESM resolution.
