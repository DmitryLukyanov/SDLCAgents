# Implementation Plan: TC-5 Simple Calculator

**Feature Branch**: `001-simple-calculator`  
**Spec**: `specs/001-simple-calculator/spec.md`  
**Created**: 2025-07-16  
**Status**: Ready

---

## Technical Context

| Concern | Decision |
|---|---|
| Language | TypeScript 5.x, strict mode |
| Runtime | Node.js ≥ 20, ESM (`"type": "module"`) |
| Module resolution | `NodeNext` — all local imports must use `.js` extensions |
| Runner | `tsx` (dev/test execution) |
| Test framework | `node:test` + `node:assert` (built-in, no install needed) |
| Trigonometry | `Math.sin` (built-in, no external dependency) |
| New dependencies | **None** |
| Source file | `src/calculator/calculator.ts` |
| Test file | `tests/calculator/calculator.test.ts` |

---

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| Small, reviewable changes | ✅ | Two files only: module + test |
| Preserve existing patterns | ✅ | Follows existing `src/<domain>/` layout |
| Add tests when behaviour changes | ✅ | Comprehensive test file planned |
| Do not weaken existing tests | ✅ | No existing tests touched |
| Do not commit secrets | ✅ | No secrets involved |
| Validate inputs at system boundaries | ✅ | FR-008/FR-009 require input validation |
| Codebase buildable & typecheck-clean after each change | ✅ | `npm run check` must pass after each commit |
| Document non-obvious decisions | ✅ | JSDoc on exported API |

---

## Phase 0: Research

### R-001 — No unknowns to resolve

All technologies are already in use in the project or are Node.js built-ins:

| Item | Resolution |
|---|---|
| `Math.sin` | Standard ECMAScript built-in, no import needed |
| `node:test` | Shipped with Node.js ≥ 18; project requires ≥ 20 |
| `node:assert` | Shipped with Node.js since v0.x |
| ESM `.js` import extensions | Required by `NodeNext` — already used throughout `src/` |
| TypeScript `unknown` for error narrowing | Standard TS strict-mode pattern |

**Decision**: No dependencies to add, no new tooling to configure.

### R-002 — Error strategy

**Decision**: Throw a custom `CalculatorError` class (extends `Error`) rather than returning a union type.  
**Rationale**: The spec states "returns a clear error" and uses thrown exceptions consistent with library usage. Throwing is idiomatic for synchronous pure functions; callers can catch and inspect `instanceof CalculatorError`. A union return type would force callers to unwrap every call site even for the happy path.  
**Alternatives considered**: `Result<T, E>` union — rejected because it adds ceremony without benefit for a simple synchronous API with no async paths.

### R-003 — Input validation approach

**Decision**: Validate with `typeof x !== 'number' || !isFinite(x)` at the top of each exported function.  
**Rationale**: FR-008 requires rejecting non-numeric inputs; FR-009 requires rejecting non-finite values to `sin`. The guard `!isFinite(x)` catches both `Infinity` and `NaN` in one check. `typeof` guard satisfies TypeScript's strict type narrowing even though the public API is typed as `number`.

---

## Phase 1: Data Model

### Entities

#### `CalculatorError`

A subclass of `Error` thrown whenever an operation cannot be completed.

| Field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description of the failure |
| `name` | `string` | Always `"CalculatorError"` (set in constructor) |

**Thrown for**:
- Division by zero (FR-005)
- Non-numeric or non-finite input to any operation (FR-008, FR-009)
- Unrecognised operation (FR-007 / SC-004) — not exposed via the typed API but documented

#### Calculator operations (pure functions, no class/state)

| Export | Signature | Description |
|---|---|---|
| `add` | `(a: number, b: number) => number` | FR-001 |
| `subtract` | `(a: number, b: number) => number` | FR-002 |
| `multiply` | `(a: number, b: number) => number` | FR-003 |
| `divide` | `(a: number, b: number) => number` | FR-004, FR-005 |
| `sin` | `(radians: number) => number` | FR-006 |
| `CalculatorError` | `class CalculatorError extends Error` | Shared error type |

### State transitions

None — all operations are pure and stateless.

### Validation rules

| Rule | Check | Error message |
|---|---|---|
| Operand must be a finite number | `typeof x !== 'number' \|\| !isFinite(x)` | `"Argument '<name>' must be a finite number, got <value>"` |
| Divisor must not be zero | `b === 0` (after finite check) | `"Division by zero is not allowed"` |
| `sin` argument must be finite | same finite guard | `"Argument 'radians' must be a finite number, got <value>"` |

---

## Phase 2: Implementation Steps

Steps are ordered to keep `npm run check` green after each commit.

### Step 1 — Create the calculator module

**File**: `src/calculator/calculator.ts`

```
src/
  calculator/
    calculator.ts   ← new
```

**Implementation outline**:

```typescript
// ── Error type ──────────────────────────────────────────────────────────────
export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}

// ── Internal guard ───────────────────────────────────────────────────────────
function assertFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new CalculatorError(
      `Argument '${name}' must be a finite number, got ${value}`
    );
  }
}

// ── Arithmetic operations ────────────────────────────────────────────────────
export function add(a: number, b: number): number { ... }
export function subtract(a: number, b: number): number { ... }
export function multiply(a: number, b: number): number { ... }
export function divide(a: number, b: number): number { ... } // throws on b === 0

// ── Trigonometry ─────────────────────────────────────────────────────────────
export function sin(radians: number): number { ... } // delegates to Math.sin
```

**Verify**: `npm run check` passes with zero errors.

---

### Step 2 — Create the test file

**File**: `tests/calculator/calculator.test.ts`

Uses `node:test` and `node:assert/strict`. Run with:

```bash
node --import tsx/esm --test tests/calculator/calculator.test.ts
```

**Test outline** (maps directly to acceptance scenarios in spec):

| Test group | Cases |
|---|---|
| `add` | 2+3=5, negative numbers, 0+0=0 |
| `subtract` | 5-3=2, result is negative |
| `multiply` | 3×4=12, multiply by zero |
| `divide` | 10÷4=2.5, throws on ÷0, throws on 0÷0 |
| `sin` | sin(0)=0, sin(π/2)≈1, sin(negative), sin(large value) |
| Input validation | non-finite (`Infinity`, `NaN`) to each op throws `CalculatorError` |

**Verify**: All tests pass; `npm run check` still clean.

---

### Step 3 — Wire npm test script (optional / additive)

Add a `test:calculator` script to `package.json` for convenience:

```json
"test:calculator": "node --import tsx/esm --test tests/calculator/calculator.test.ts"
```

> **Note**: This is additive-only. No existing script is modified.

---

## Contracts

The calculator module is a **pure TypeScript library** with no external interface (no HTTP, no CLI, no IPC). The public API surface is its TypeScript export signature — documented via JSDoc in the source file. No separate contract file is needed.

Public API (stable surface for consumers):

```typescript
export class CalculatorError extends Error { }
export function add(a: number, b: number): number;
export function subtract(a: number, b: number): number;
export function multiply(a: number, b: number): number;
export function divide(a: number, b: number): number;   // throws CalculatorError on ÷0
export function sin(radians: number): number;           // input in radians
```

All functions throw `CalculatorError` for invalid or non-finite inputs.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `NodeNext` module resolution requires `.js` suffix on local imports | Low (no local imports in calculator module — it's self-contained) | N/A for this module; noted for future consumers |
| Floating-point precision in `sin` tests | Low | Use `assert.ok(Math.abs(result - expected) < 1e-10)` rather than `strictEqual` for irrational results |
| Shadowing built-in `Math.sin` with exported `sin` | None | The export is named `sin`, not `Math.sin`; no conflict |

---

## Definition of Done

- [ ] `src/calculator/calculator.ts` exists and exports the full API
- [ ] `tests/calculator/calculator.test.ts` covers FR-001 through FR-011
- [ ] All node:test cases pass
- [ ] `npm run check` exits 0 (typecheck clean)
- [ ] No new npm dependencies added
- [ ] JSDoc present on all exported symbols
