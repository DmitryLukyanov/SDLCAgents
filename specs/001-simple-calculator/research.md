# Research: Simple Calculator (TC-5)

**Phase**: 0 — Outline & Research  
**Branch**: `001-simple-calculator`  
**Status**: Complete — all clarifications resolved from user input session

---

## Decision Log

All key design decisions were resolved directly with the author before planning began. No external research was required — all questions answered definitively.

---

### D-01: API Shape — Named Exports vs. Single Dispatcher

**Decision**: Named exports — individual functions per operation.

```typescript
export function add(a: number, b: number): number
export function subtract(a: number, b: number): number
export function multiply(a: number, b: number): number
export function divide(a: number, b: number): number
export function sin(x: number): number
```

**Rationale**: Named exports give callers type-safe, auto-completed, tree-shakeable access. A single dispatcher (`calculate('add', a, b)`) would require a string union type and loses argument-count type safety for unary `sin`. Named exports match the existing codebase style (no files use a dispatcher pattern).

**Alternatives considered**:
- Single `calculate(op, ...args)` dispatcher → rejected: weaker types, string-based operation names
- Class-based `Calculator` instance → rejected: adds unnecessary statefulness and instantiation boilerplate for pure functions

---

### D-02: Error Signalling — throw vs. Return Value

**Decision**: Throw `Error` objects.

```typescript
throw new Error('Division by zero');
throw new Error('Argument "a" must be a number, got string');
```

**Rationale**: Matches the codebase pattern exactly (see `src/lib/encoded-config.ts`, `src/lib/jira-status.ts`, `src/dummy-agent/dummy-agent.ts`). Callers use standard try/catch; no wrapper type needed. TypeScript's `strict` mode does not require explicit return-type unions for thrown errors.

**Alternatives considered**:
- `Result<T, E>` discriminated union → rejected: not used anywhere in codebase; requires callers to unwrap every result
- Return `null` / `undefined` on error → rejected: spec explicitly forbids silent failure (FR-010)

---

### D-03: NaN Policy — Mathematical NaN Results

**Decision**: Mathematical NaN is a valid return value; do **not** throw for it.

**Rationale**: `Math.sin(Infinity)` returns `NaN` per IEEE 754. This is a well-defined numeric outcome for an unbounded argument. The spec (edge cases section) explicitly states: "The result is NaN following standard numeric conventions; no crash occurs." FR-010 ("never silently return NaN without an error signal") applies to **invalid inputs**, not to mathematically valid NaN outputs.

**Boundary clarification**:
- `sin(Infinity)` → returns `NaN` ✅ (mathematical NaN — valid)
- `sin("hello")` → throws Error ✅ (non-numeric input — invalid)
- `add(NaN, 1)` → ⚠️ NaN passed as argument: `typeof NaN === 'number'` passes the type guard, result is `NaN`. **Decision**: allow — NaN is a legal `number` subtype in IEEE 754; callers who pass NaN get NaN back, consistent with JavaScript numeric semantics. Documenting this explicitly.

---

### D-04: Numeric String Inputs — Accept or Reject

**Decision**: Reject — only `number` type accepted. Numeric strings (`"42"`, `"3.14"`) throw an error.

**Rationale**: TypeScript's type system would normally prevent this at compile time, but runtime validation is required because callers may use `as any` or receive values from untyped sources. Rejecting strings avoids silent coercion bugs. The guard uses `typeof x !== 'number'`.

```typescript
if (typeof a !== 'number') {
  throw new Error(`Argument "a" must be a number, got ${typeof a}`);
}
```

**Alternatives considered**:
- Coerce numeric strings with `Number(x)` → rejected: hides bugs, conflates types
- Accept only via TypeScript types (no runtime check) → rejected: insufficient for runtime safety per FR-009

---

### D-05: Angle Unit for sin()

**Decision**: Radians only. No degree conversion.

**Rationale**: Standard mathematical convention; explicitly stated in spec Assumptions section. `Math.sin()` natively expects radians.

---

### D-06: Division by Zero

**Decision**: Throw `Error` — do **not** return `Infinity`.

**Rationale**: FR-005 is explicit: "MUST return a clear, explicit error when division by zero is attempted; it MUST NOT return Infinity silently." JavaScript's `1/0 === Infinity` must be intercepted.

```typescript
if (b === 0) throw new Error('Division by zero');
```

Edge case — `0/0`: JavaScript returns `NaN`. Since `b === 0` is checked first regardless of `a`, this is also caught and thrown as division-by-zero.

---

### D-07: Module Format

**Decision**: ESM with `.js` extensions on all local imports (NodeNext resolution).

**Rationale**: `package.json` has `"type": "module"` and `tsconfig.json` has `"module": "NodeNext"` and `"verbatimModuleSyntax": true`. All existing source files use `.js` import extensions (e.g., `import { adfToPlain } from './adf-to-plain.js'`). This project uses `tsx` to run TypeScript directly; no compile step to dist/.

---

### D-08: Test Runner

**Decision**: Node.js built-in `node:test` with `node:assert/strict`.

**Rationale**: Node.js ≥ 20 (project requirement) ships a stable test runner in core. No additional packages needed. Works natively with ESM. Tests run with: `node --test --experimental-test-module-mocks tests/calculator/*.test.ts` (via `tsx`).

**Alternatives considered**:
- Vitest → rejected: would add a dev dependency where none currently exists; overkill for 5 pure functions
- Jest → rejected: ESM configuration complexity; no existing Jest config in repo
- Mocha → rejected: same reasoning as Jest

---

### D-09: File Layout

**Decision**: Two source files under `src/calculator/` + barrel index.

```
src/calculator/
├── index.ts        ← barrel: re-exports all 5 functions
├── arithmetic.ts   ← add, subtract, multiply, divide
└── trigonometry.ts ← sin
```

**Rationale**: Separates arithmetic (4 binary functions) from trigonometric (1 unary function) by domain, consistent with potential future extension. Barrel `index.ts` gives callers a single clean import path: `import { add, sin } from './calculator/index.js'`.

---

## Resolved Clarifications Summary

| # | Question | Answer |
|---|----------|--------|
| Q1 | API shape: dispatcher vs. named exports? | Named exports |
| Q2 | Error signalling: throw vs. return? | Throw `Error` objects |
| Q3 | NaN from math ops (sin(Infinity))? | Valid — do not throw |
| Q4 | Numeric strings: accept or reject? | Reject — only `number` type |
| Q5 | Angle unit? | Radians |
| Q6 | Division by zero return? | Throw Error (not Infinity) |
| Q7 | Module format? | ESM NodeNext (.js extensions) |
| Q8 | Test runner? | `node:test` built-in |
| Q9 | Trigonometric functions beyond sin? | None — sin only (FR-007) |
