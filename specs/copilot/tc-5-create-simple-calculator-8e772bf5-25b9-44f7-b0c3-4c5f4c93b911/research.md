# Research: Simple Calculator

**Phase**: 0 — Outline & Research  
**Date**: 2026-03-29  
**Feature**: TC-5 Simple Calculator

---

## 1. Test Runner

### Decision
Use Node.js built-in `node:test` module, invoked via `tsx --test` to support TypeScript files without a separate compile step.

### Rationale
- `node:test` has been stable since Node.js 20 (the project's minimum runtime).
- The project already has `tsx` as a dev dependency (`^4.19.2`); `tsx --test <glob>` runs TypeScript test files natively without adding any new packages.
- `node:assert/strict` provides assertion primitives; no third-party assertion library is needed.
- Zero new `devDependencies`; the approach matches the project's no-external-libraries constraint.

### Alternatives Considered
| Option | Reason Rejected |
|--------|----------------|
| **Vitest** | Requires adding `vitest` + config file; violates "no new dependencies" spirit for such a small feature |
| **Jest + ts-jest** | Two new packages, complex ESM configuration overhead |
| **Mocha + tsx** | Additional package; `node:test` subsumes it since Node 20 |

### Usage Pattern
```json
// package.json addition
"test:calculator": "tsx --test tests/calculator/**/*.test.ts"
```
```typescript
// test file skeleton
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../../src/calculator/calculator.ts';

test('5 + 3 = 8', () => {
  const result = calculate('5 + 3');
  assert.ok(result.success);
  assert.strictEqual(result.value, 8);
});
```

---

## 2. Degrees-to-Radians Conversion

### Decision
Convert using the formula `radians = degrees * (Math.PI / 180)` before passing to `Math.sin()`.

### Rationale
`Math.sin()` accepts radians. The spec requires degree input. The standard conversion is:
```
radians = degrees × π / 180
```
JavaScript's `Math.PI` provides π to full IEEE 754 double precision. This conversion is exact within double-precision limits; no rounding artefacts appear at the common test angles (0°, 30°, 90°, -90°).

### Verification of Key Test Angles
| Input (°) | Radians | `Math.sin(radians)` | Expected |
|-----------|---------|---------------------|----------|
| 0 | 0 | 0 | 0 ✓ |
| 30 | π/6 ≈ 0.5236 | 0.49999…9 → rounds to 0.5 | 0.5 ✓ |
| 90 | π/2 ≈ 1.5708 | 1.0 | 1 ✓ |
| -90 | -π/2 | -1.0 | -1 ✓ |

> `sin(30°)` returns `0.49999999999999994` in IEEE 754. After rounding to 10 significant figures (`toPrecision(10)`) and stripping trailing zeros the result is `0.5`. This meets FR-009's "at least 4 decimal places" accuracy requirement.

### Implementation Snippet
```typescript
export function sinDegrees(degrees: number): number {
  return Math.sin(degrees * (Math.PI / 180));
}
```

---

## 3. Input Parsing Strategy

### Decision
Regex-based parser with two patterns — one for binary arithmetic expressions, one for the `sin()` unary form. No AST, no eval, no expression-tree library.

### Rationale
- The spec restricts input to exactly two forms: `<num> <op> <num>` and `sin(<num>)`.
- A regex captures operands, operator, and expression type in a single pass — no tokeniser or grammar is needed.
- Zero dependencies, easy to unit-test, and hard to exploit (no `eval` path).

### Canonical Regex Patterns

**Binary expression** (`5 + 3`, `-3.5 * 2`, `10 / 4`):
```
/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/
```
| Group | Captures |
|-------|---------|
| 1 | Left operand (integer or decimal, optional leading `-`) |
| 2 | Operator: one of `+`, `-`, `*`, `/` |
| 3 | Right operand (integer or decimal, optional leading `-`) |

**Unary sin expression** (`sin(30)`, `sin(-90)`, `sin(3.14)`):
```
/^sin\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)$/
```
| Group | Captures |
|-------|---------|
| 1 | Angle operand in degrees |

### Parse Order
1. Strip leading/trailing whitespace from raw input.
2. Check against unary pattern first (prevents ambiguity).
3. Then check binary pattern.
4. Neither match → `ParseError` with a descriptive message.

### Edge Cases Handled by Regex
| Input | Behaviour |
|-------|-----------|
| `5 - -3` | Binary: left=5, op=`-`, right=`-3` ✓ |
| `sin( 30 )` | Unary: operand=30 (inner whitespace tolerated) ✓ |
| `sin` or `sin 30` | No match → parse error ✓ |
| `cos(30)`, `%`, `^` | No match → "unsupported operation" error ✓ |
| ` ` (blank) | Stripped to `""` → parse error with prompt to enter valid expression ✓ |

---

## 4. Result Formatting

### Decision
Format numbers using `parseFloat(num.toPrecision(10)).toString()`.

### Rationale
- `toPrecision(10)` produces exactly 10 significant figures without using scientific notation for typical results.
- Wrapping with `parseFloat()` removes the trailing zeros that `toPrecision` preserves by default.
- `.toString()` gives a clean decimal representation for ordinary magnitudes.
- No string-manipulation hacks; standard JavaScript number formatting.

### Verification of Key Formatting Cases
| Value | `toPrecision(10)` | `parseFloat(...)` | `.toString()` | Output |
|-------|-------------------|-------------------|---------------|--------|
| `8` | `"8.000000000"` | `8` | `"8"` | `8` ✓ |
| `0.5` | `"0.5000000000"` | `0.5` | `"0.5"` | `0.5` ✓ |
| `1/3` | `"0.3333333333"` | `0.3333333333` | `"0.3333333333"` | `0.3333333333` ✓ |
| `Math.PI` | `"3.141592654"` | `3.141592654` | `"3.141592654"` | `3.141592654` ✓ |
| `sinDegrees(30)` | `"0.5000000000"` | `0.5` | `"0.5"` | `0.5` ✓ |

### Special Cases
- `Infinity`, `-Infinity`, `NaN` → intercepted **before** formatting; display `"Result is out of numeric range"` (FR-011).
- Division by zero → intercepted in calculator core; display `"Division by zero is not allowed"` (FR-004).

### Implementation Snippet
```typescript
export function formatNumber(value: number): string {
  if (!isFinite(value) || isNaN(value)) {
    return 'Result is out of numeric range';
  }
  return parseFloat(value.toPrecision(10)).toString();
}
```

---

## 5. Module Layout

### Decision
Place all calculator source under `src/calculator/` as a self-contained module alongside existing agents, with test files mirrored under `tests/calculator/`.

### Rationale
This mirrors the existing project convention:
```
src/scrum-agent/   →  scrum-master-core.ts, scrum-master.ts
src/dummy-agent/   →  dummy-agent.ts, dummy-agent-entry.ts
```
The pattern separates library logic from the entry point (core + entry). The calculator follows the same split:
```
src/calculator/calculator.ts   ←→   src/scrum-agent/scrum-master-core.ts
src/calculator/cli.ts          ←→   src/scrum-agent/scrum-master.ts
```

### File Responsibilities
| File | Responsibility |
|------|---------------|
| `types.ts` | Shared TypeScript types and enums (no runtime behaviour) |
| `parser.ts` | Parses a raw string into a `ParsedExpression` or returns a `ParseError` |
| `calculator.ts` | Evaluates a `ParsedExpression`; handles division by zero and overflow |
| `formatter.ts` | Converts a `CalculatorResult` value to a display string |
| `index.ts` | Re-exports the public library API (`calculate`, `formatNumber`, types) |
| `cli.ts` | REPL loop using `node:readline`; not exported from `index.ts` |

---

## 6. CLI Entry Point Pattern

### Decision
Two separate files: `cli.ts` (REPL) and `index.ts` (library). `cli.ts` imports from `index.ts`; `index.ts` does **not** import from `cli.ts`. A `"calculator"` script is added to `package.json`.

### Rationale
- Matches the existing project pattern (`scrum-master.ts` imports from `scrum-master-core.ts`).
- Library consumers import only `index.ts`; `node:readline` (a CLI concern) never enters the library bundle.
- Tests import `calculator.ts` and `parser.ts` directly without any readline mocking.
- `cli.ts` is the sole file that reads `process.stdin` / writes `process.stdout`.

### package.json Additions
```json
"scripts": {
  "calculator":      "tsx src/calculator/cli.ts",
  "test:calculator": "tsx --test tests/calculator/**/*.test.ts"
}
```

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Test runner | `node:test` via `tsx --test` | Zero new deps; Node 20 built-in; TypeScript support via existing tsx |
| Degree conversion | `degrees * (Math.PI / 180)` | Standard formula; verified against all spec test angles |
| Binary parse | Regex `/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/` | Covers integers, decimals, negative operands; no eval |
| Unary parse | Regex `/^sin\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)$/` | Strict sin() form; tolerates inner whitespace |
| Number format | `parseFloat(num.toPrecision(10)).toString()` | 10 sig figs, trailing zeros stripped, plain integers |
| Module layout | `src/calculator/{types,parser,calculator,formatter,index,cli}.ts` | Consistent with existing agent pattern |
| CLI pattern | Separate `cli.ts` + `index.ts` library entry | No readline in library; no mocking needed in tests |
