# Implementation Plan: Simple Calculator

**Branch**: `001-simple-calculator` | **Date**: 2025-01-01 | **Spec**: `specs/001-simple-calculator/spec.md`  
**Input**: Feature specification from `/specs/001-simple-calculator/spec.md`

---

## Summary

Implement a pure, side-effect-free TypeScript ESM module (`src/calculator/calculator.ts`) that exposes five named exports — `add`, `subtract`, `multiply`, `divide`, and `sin` — backed by validated IEEE 754 arithmetic. All inputs are validated for finiteness at runtime; invalid inputs and division by zero throw descriptive `Error` instances. A companion test file (`tests/calculator/calculator.test.ts`) covers all acceptance scenarios using the project's existing `tsx` runner (no external test framework required).

---

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode, `verbatimModuleSyntax: true`)  
**Primary Dependencies**: None — `Math.sin` is a JavaScript built-in; no new packages required  
**Storage**: N/A (pure in-memory computation, no I/O)  
**Testing**: No installed framework; test file driven by `tsx` via a `package.json` script (consistent with existing `scrum-master:debug` pattern)  
**Target Platform**: Node.js ≥ 20, ESM (`"type": "module"` in `package.json`, `module: NodeNext` in `tsconfig.json`)  
**Project Type**: Library module (programmatic API, no CLI or web interface)  
**Performance Goals**: Not applicable — all operations are O(1) arithmetic on primitive numbers  
**Constraints**: Zero new runtime dependencies; functions must be pure (no side effects, no global state)  
**Scale/Scope**: Five functions, one file, one test file

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **Quality** — small, reviewable change with clear intent | Two files added (`src/calculator/calculator.ts`, `tests/calculator/calculator.test.ts`); changes are self-contained and scoped to one feature | ✅ PASS |
| **Quality** — preserve existing patterns | ESM named exports match the project's `"type": "module"` + `NodeNext` setup; no existing patterns are altered | ✅ PASS |
| **Testing** — add tests when behaviour changes | New behaviour is fully covered by a new test file that exercises all five operations, edge cases, and error paths | ✅ PASS |
| **Testing** — do not weaken existing tests | No existing tests are touched | ✅ PASS |
| **Security** — validate inputs at system boundaries | All five functions call a shared `assertFiniteNumber` guard before computation; `NaN`, `±Infinity`, and non-`number` types all throw descriptive errors | ✅ PASS |
| **Security** — do not commit secrets | No credentials, tokens, or secrets involved | ✅ PASS |
| **Delivery** — codebase stays buildable after change | Both files must pass `tsc --noEmit` before commit; no new `@ts-ignore` or `any` casts | ✅ PASS |
| **Delivery** — document non-obvious decisions | Inline comments explain the `assertFiniteNumber` guard rationale and the `Number.isFinite` vs `typeof` choice | ✅ PASS |

**Gate result**: No violations. No complexity-tracking table required.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-simple-calculator/
├── spec.md              # Feature specification (existing)
├── plan.md              # This file
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code

```text
src/
└── calculator/
    └── calculator.ts    # NEW — five named exports + shared input guard

tests/
└── calculator/
    └── calculator.test.ts   # NEW — manual test runner using tsx
```

**Structure Decision**: Single-project layout (Option 1). The calculator is a pure utility module with no sub-packages; it sits alongside the existing `src/scrum-agent`, `src/dummy-agent`, and `src/lib` directories without disturbing them.

---

## Design

### `src/calculator/calculator.ts`

#### Input validation

A single internal helper (`assertFiniteNumber`) is called at the top of every exported function:

```typescript
function assertFiniteNumber(value: unknown, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Invalid input: "${name}" must be a finite number, got ${String(value)}`
    );
  }
}
```

- `typeof value !== 'number'` catches runtime non-number values (strings, booleans, `null`, `undefined`, objects) even though TypeScript types prevent them at compile time. This satisfies FR-008 and SC-003 for runtime callers (e.g., JavaScript consumers or type assertions).
- `!Number.isFinite(value)` additionally rejects `NaN`, `Infinity`, and `-Infinity` that are of type `number`.

#### Exported functions

| Export | Signature | Key behaviour |
|--------|-----------|---------------|
| `add` | `(a: number, b: number): number` | Returns `a + b` |
| `subtract` | `(a: number, b: number): number` | Returns `a - b` |
| `multiply` | `(a: number, b: number): number` | Returns `a * b` |
| `divide` | `(a: number, b: number): number` | Validates inputs; throws `"Division by zero"` when `b === 0`; returns `a / b` |
| `sin` | `(angle: number): number` | Validates input; delegates to `Math.sin(angle)` |

All functions use `export function` (ESM named exports). No default export is provided (FR-009). The file has no top-level side effects (FR-010).

#### Division-by-zero check

`divide` performs the zero-divisor check **after** `assertFiniteNumber` so the error message is unambiguous:

```typescript
export function divide(a: number, b: number): number {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  if (b === 0) {
    throw new Error('Division by zero: divisor "b" must not be 0');
  }
  return a / b;
}
```

### `tests/calculator/calculator.test.ts`

The project has no installed test framework. The existing debug-script pattern (`tests/scrum-agent/scrum-master.local-debug.ts`, run via `tsx`) is adopted. The test file is a self-contained script that:

1. Imports the five functions from `../../src/calculator/calculator.js` (`.js` extension required by NodeNext resolution).
2. Defines a minimal `assert` helper and a `test` helper that tracks pass/fail counts.
3. Runs all acceptance scenarios from the spec (User Story 1, User Story 2, Edge Cases).
4. Prints a summary and exits with code `1` on any failure.

A new `package.json` script is added:

```json
"calculator:test": "tsx tests/calculator/calculator.test.ts"
```

#### Test coverage plan

| Category | Cases |
|----------|-------|
| `add` | `(3, 4) → 7`, `(-1, 1) → 0`, `(0, 0) → 0`, large values |
| `subtract` | `(10, 3) → 7`, `(0, 5) → -5`, negatives |
| `multiply` | `(4, 5) → 20`, `(0, N) → 0`, negatives |
| `divide` | `(10, 2) → 5`, `(7, 0) → throws`, `(-6, 3) → -2` |
| `sin` | `sin(0) ≈ 0`, `sin(π/2) ≈ 1`, `sin(π) ≈ 0`, `sin(-π/2) ≈ -1` |
| Invalid inputs | `NaN`, `Infinity`, `-Infinity`, `"3"` (string cast), `undefined` — all must throw |
| SC-004 tolerance | `|result - expected| < 1e-10` for all `sin` assertions |

---

## Implementation Sequence

The following order ensures the codebase is typecheck-clean and testable at each step:

1. **Create `src/calculator/calculator.ts`** — implement `assertFiniteNumber` guard and all five exports.
2. **Run `tsc --noEmit`** — confirm zero type errors before writing any tests.
3. **Create `tests/calculator/calculator.test.ts`** — implement all test cases.
4. **Add `calculator:test` script to `package.json`** — keep invocation consistent with existing scripts.
5. **Run `tsx tests/calculator/calculator.test.ts`** — confirm all tests pass (exit code 0).
6. **Run `tsc --noEmit`** — final typecheck covering both source and test files.
7. **Commit** — single atomic commit with all files.

---

## Open Questions

None. All functional requirements are fully specified in the spec. The module-format question was resolved in the spec's Clarifications section (ESM named exports, NodeNext resolution). No external research is required.
