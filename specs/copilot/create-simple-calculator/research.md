# Research: Simple Calculator

**Phase**: 0 — Outline & Research  
**Feature**: Simple Calculator Library  
**Branch**: `copilot/create-simple-calculator`

---

## R-001 · Testing Framework for TypeScript ESM (Node ≥ 20)

**Question**: Which test runner should be used for a TypeScript ESM project on Node ≥ 20 with no existing test framework?

**Decision**: **Node.js built-in `node:test` runner** (available since Node 18, stable in Node 20).

**Rationale**:
- Zero new runtime or dev dependencies — the project already mandates `node >= 20`.
- Native ESM support; no configuration required for `"type": "module"` projects.
- Works directly with `tsx` (already in `devDependencies`) for TypeScript source files via the `--import tsx/esm` flag or by pre-compiling.
- The `node:assert/strict` module provides sufficient assertion depth for pure unit tests.
- Output is TAP-compatible and parseable by CI.

**Alternatives considered**:

| Alternative | Verdict |
|---|---|
| **Vitest** | Best DX and watch mode; adds ~5 MB to devDependencies. Viable if the project later adopts a broader test suite. Rejected here to avoid new dependencies for a small utility. |
| **Jest** | Needs Babel or `ts-jest` transform to handle ESM; significant configuration overhead for a 5-function library. Rejected. |
| **Mocha + ts-node** | Older ecosystem; more config than `node:test`. Rejected. |

**Test invocation**:
```bash
# Run all calculator tests
node --import tsx/esm --test tests/calculator/*.test.ts
```

---

## R-002 · Runtime Input Validation in TypeScript

**Question**: How should a TypeScript library validate numeric inputs at runtime given that callers could be JavaScript consumers who bypass compile-time type checking?

**Decision**: A shared `assertNumber(value, paramName)` guard using `typeof` + `Number.isNaN`.

**Rationale**:
- `typeof x !== 'number'` catches strings, `undefined`, `null`, objects, and booleans.
- `Number.isNaN(x)` catches `NaN` (since `typeof NaN === 'number'` is `true` in JavaScript).
- Throwing `TypeError` with a descriptive message matches the spec requirement (FR-008) and standard JavaScript conventions (see `Array.from`, `JSON.parse` etc.).
- Does **not** reject `Infinity`/`-Infinity` — those are valid `number` values within IEEE 754 and the spec says: "results outside float64 range MUST follow IEEE 754 semantics". `Infinity` as *input* to `add` is legal.

**Pattern**:
```typescript
function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    const type = Number.isNaN(value) ? 'NaN' : typeof value;
    throw new TypeError(
      `Argument '${name}' must be a finite or infinite number; received ${type}.`
    );
  }
}
```

**Alternatives considered**:

| Alternative | Verdict |
|---|---|
| Zod / io-ts schema validation | Adds external dependency for a simple guard. Rejected. |
| `Number.isFinite` check | Would reject `Infinity` inputs, which the spec explicitly allows through IEEE 754. Rejected. |
| No runtime validation | Violates FR-008. Rejected. |

---

## R-003 · Sine Function Implementation

**Question**: Should `sin(x)` use `Math.sin`, a Taylor-series approximation, or an external math library?

**Decision**: Delegate directly to **`Math.sin(x)`**.

**Rationale**:
- `Math.sin` is a built-in ECMAScript function backed by the host's native floating-point sine implementation (typically hardware FPU instruction `fsin` or equivalent).
- JavaScript engines guarantee IEEE 754 double-precision semantics, matching SC-002's "up to 10 decimal places" and float64 bounds requirements.
- No external dependency needed.
- `Math.sin(NaN)` returns `NaN`, so the input guard (R-002) must run **before** the delegate call to fulfil FR-008.

**Alternatives considered**:

| Alternative | Verdict |
|---|---|
| Taylor series implementation | Slower, less accurate, more code. Rejected. |
| `mathjs` library | External dependency (~500 kB) unnecessary for a single function. Rejected. |

---

## R-004 · Division-by-Zero Error Strategy

**Question**: Should `divide(a, 0)` return a special sentinel value (`Infinity`, `NaN`, `null`) or throw an `Error`?

**Decision**: **Throw `Error`** with a descriptive message.

**Rationale**:
- The spec (FR-005, Edge Cases) explicitly says: "the function throws or returns a clear error". Throwing keeps the API consistent with the TypeError pattern from FR-008.
- `divide(9, 0)` in raw JavaScript returns `Infinity`, not an error. Callers cannot distinguish "intentional infinity input" from "divide-by-zero bug" if we propagate `Infinity` silently.
- Throwing also satisfies SC-003 ("no runtime crash"; the library remains callable afterward — verified by post-error call tests).
- Use plain `Error` (not `TypeError`) since the inputs are valid numbers; the *operation* itself is undefined.

**Pattern**:
```typescript
if (b === 0) {
  throw new Error('Division by zero: divisor must not be 0.');
}
```

**Alternatives considered**:

| Alternative | Verdict |
|---|---|
| Return `Infinity` | Silently swallows a logical error. Rejected. |
| Return `{ error: string }` union type | Breaks the simple `number` return contract; forces every caller to check for errors. Rejected. |
| Custom `DivisionByZeroError` class | Adds a class export; overkill for a minimal library. Viable but not chosen. |

---

## R-005 · Module Entry Point & Export Strategy

**Question**: How should the library be exported so consumers can import named functions?

**Decision**: Single file `src/lib/calculator.ts` with **named ESM exports**, consistent with existing `src/lib/*.ts` files.

**Rationale**:
- Matches project conventions (`src/lib/jira-status.ts`, `src/lib/encoded-config.ts`).
- `"type": "module"` + `"moduleResolution": "NodeNext"` in `tsconfig.json` means no barrel file is needed for a single-module library.
- Consumers import with: `import { add, subtract, multiply, divide, sin } from './lib/calculator.ts'` (or the compiled `.js` path).
- No default export — named exports are explicit and tree-shakeable.

**Alternatives considered**:

| Alternative | Verdict |
|---|---|
| Separate files per function (`add.ts`, `subtract.ts` …) | Overkill for five small functions. Rejected. |
| Re-export barrel `src/lib/index.ts` | Premature for a single library file. Rejected. |
| Default export object `{ add, subtract … }` | Prevents tree-shaking; non-standard for library APIs. Rejected. |

---

## Summary Table

| ID | Topic | Decision |
|---|---|---|
| R-001 | Test runner | `node:test` built-in (Node 20) |
| R-002 | Input validation | `assertNumber` using `typeof` + `Number.isNaN`, throws `TypeError` |
| R-003 | Sine implementation | Delegate to `Math.sin` |
| R-004 | Division by zero | Throw plain `Error` |
| R-005 | Module structure | Single file `src/lib/calculator.ts`, named ESM exports |

All NEEDS CLARIFICATION items resolved. Phase 1 design can proceed.
