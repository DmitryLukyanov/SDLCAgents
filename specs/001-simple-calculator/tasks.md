---
description: "Task list for Simple Calculator (TC-5) implementation"
---

# Tasks: Simple Calculator (TC-5)

**Input**: Design documents from `/specs/001-simple-calculator/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · data-model.md ✅ · research.md ✅ · contracts/calculator-api.ts ✅ · quickstart.md ✅

**Feature**: TypeScript library module exposing `add`, `subtract`, `multiply`, `divide`, and `sinDeg` as named ESM exports.
**Stack**: TypeScript 5.7 / Node.js ≥20 / ESM (NodeNext) / Vitest 4.1.2
**Files created**: `src/lib/calculator.ts`, `tests/unit/calculator.test.ts`
**Files modified**: `package.json`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (touches a different file or is read-only)
- **[US1]** / **[US2]**: Maps to User Story 1 / 2 from spec.md
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install the test framework and configure the project so tests can be discovered and executed.

- [X] T001 Add `vitest@4.1.2` to `devDependencies` in `package.json`; add `"test": "vitest run"` and `"test:watch": "vitest"` entries to the `scripts` block; do **not** remove or alter any existing scripts

**Checkpoint**: `npm test` exits without error (no test files yet — zero tests pass is fine at this stage)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the calculator module skeleton with private shared helpers that every exported function depends on. Neither user story can be implemented until this phase is complete.

**⚠️ CRITICAL**: All five exported functions call the same two private helpers. Phase 3 and Phase 4 both depend on this phase completing successfully.

- [X] T002 Create `src/lib/calculator.ts` as an ESM module skeleton with two private (non-exported) helpers:
  - `assertNumber(x: unknown, argName: string): asserts x is number` — validation guard applied to every argument before any computation. Validation sequence (order matters): **(1)** if `typeof x !== 'number' || isNaN(x as number)` → `throw new TypeError(\`Invalid input: expected a finite number for '${argName}', got ${typeof x}\`)`; **(2)** if `!isFinite(x as number) || Math.abs(x as number) > Number.MAX_SAFE_INTEGER` → `throw new RangeError("Input exceeds supported numeric range")`
  - `formatResult(value: number): number` — rounding applied to every computed result before return: `return parseFloat(value.toFixed(4))` (drops trailing zeros so integers stay whole, e.g. `13.0000` → `13`; `0.3333` stays `0.3333`)
  - No exported symbols yet; the file must compile cleanly with `npm run check`

**Checkpoint**: `npm run check` exits with no TypeScript errors

---

## Phase 3: User Story 1 — Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Deliver `add`, `subtract`, `multiply`, and `divide` as individually callable, validated, named exports. Division by zero and invalid inputs throw typed errors with exact messages. Non-integer results are rounded to 4 dp.

**Independent Test**: Call each of the four arithmetic functions with valid numeric pairs and confirm correct results; call `divide(7, 0)` and confirm `Error("Cannot divide by zero")`; call any function with `null` / `undefined` / `NaN` and confirm `TypeError`.

### Tests for User Story 1

> **Write these tests FIRST — they must FAIL before implementation begins (T004–T007)**

- [X] T003 [US1] Create `tests/unit/calculator.test.ts`; import `{ add, subtract, multiply, divide }` from `'../../../src/lib/calculator.js'` (NodeNext `.js` extension required); add the following four `describe` blocks with `it` / `expect` cases:
  - **`describe('add')`**: `add(8, 5)` → `13`; `add(0, 0)` → `0`; `add(-3, 3)` → `0`; `add(0.1, 0.2)` → `0.3`; `add(1.2345, 1.2345)` → `2.469`; passing `null` throws `TypeError`; passing `undefined` throws `TypeError`; passing `NaN` throws `TypeError`; passing `Number.MAX_SAFE_INTEGER + 1` throws `RangeError`; passing `Infinity` throws `RangeError`
  - **`describe('subtract')`**: `subtract(10, 4)` → `6`; `subtract(0, 5)` → `-5`; `subtract(5, 5)` → `0`; passing `null` throws `TypeError`; passing `Number.MAX_SAFE_INTEGER + 1` throws `RangeError`
  - **`describe('multiply')`**: `multiply(6, 7)` → `42`; `multiply(3, 1.5)` → `4.5`; `multiply(0, 999)` → `0`; `multiply(-2, 3)` → `-6`; passing `null` throws `TypeError`; passing `Infinity` throws `RangeError`
  - **`describe('divide')`**: `divide(20, 4)` → `5`; `divide(1, 3)` → `0.3333`; `divide(7, 0)` throws `Error` with message `"Cannot divide by zero"`; `divide(-10, 2)` → `-5`; passing `null` for dividend throws `TypeError`; passing `Number.MAX_SAFE_INTEGER + 1` throws `RangeError`

### Implementation for User Story 1

- [X] T004 [US1] Implement and export `add(a: number, b: number): number` in `src/lib/calculator.ts`: call `assertNumber(a, 'a')` then `assertNumber(b, 'b')`; return `formatResult(a + b)`
- [X] T005 [US1] Implement and export `subtract(a: number, b: number): number` in `src/lib/calculator.ts`: call `assertNumber(a, 'a')` then `assertNumber(b, 'b')`; return `formatResult(a - b)`
- [X] T006 [US1] Implement and export `multiply(a: number, b: number): number` in `src/lib/calculator.ts`: call `assertNumber(a, 'a')` then `assertNumber(b, 'b')`; return `formatResult(a * b)`
- [X] T007 [US1] Implement and export `divide(a: number, b: number): number` in `src/lib/calculator.ts`: call `assertNumber(a, 'a')` then `assertNumber(b, 'b')`; if `b === 0` throw `new Error("Cannot divide by zero")`; return `formatResult(a / b)`
- [X] T008 [US1] Run `npm test` and confirm all US1 arithmetic tests pass (green); run `npm run check` and confirm zero TypeScript errors; both must be clean before proceeding to Phase 4

**Checkpoint**: User Story 1 is fully functional — `add`, `subtract`, `multiply`, `divide` work correctly and all their tests pass independently

---

## Phase 4: User Story 2 — Sine Function (Priority: P2)

**Goal**: Deliver `sinDeg` as a named export. Input is interpreted in **degrees** (not radians). Floating-point artifacts (e.g. `sinDeg(180)` ≈ `1.2e-16`) resolve to `0` after 4 dp rounding. Non-numeric inputs throw `TypeError`; out-of-range inputs throw `RangeError`.

**Independent Test**: Call `sinDeg(0)` → `0`, `sinDeg(90)` → `1`, `sinDeg(30)` → `0.5`, `sinDeg(-90)` → `-1`, `sinDeg(180)` → `0`, `sinDeg(45)` → `0.7071`; confirm these match within ±0.0001 tolerance (SC-002).

### Tests for User Story 2

> **Write these tests FIRST — they must FAIL before implementation begins (T010)**

- [X] T009 [US2] Add `import { sinDeg }` to the existing `tests/unit/calculator.test.ts` import statement; append a `describe('sinDeg')` block with the following `it` / `expect` cases: `sinDeg(0)` → `0`; `sinDeg(90)` → `1`; `sinDeg(30)` → `0.5`; `sinDeg(-90)` → `-1`; `sinDeg(180)` → `0` (floating-point artifact resolved by 4 dp rounding); `sinDeg(45)` → `0.7071`; `sinDeg(270)` → `-1`; `sinDeg(360)` → `0`; passing a string throws `TypeError`; passing `null` throws `TypeError`; passing `Infinity` throws `RangeError`; passing `Number.MAX_SAFE_INTEGER + 1` throws `RangeError`

### Implementation for User Story 2

- [X] T010 [US2] Implement and export `sinDeg(x: number): number` in `src/lib/calculator.ts`: call `assertNumber(x, 'x')`; convert degrees to radians: `const rad = x * (Math.PI / 180)`; return `formatResult(Math.sin(rad))`
- [X] T011 [US2] Run `npm test` and confirm all US2 sinDeg tests pass (green) including the `sinDeg(180)` → `0` floating-point case; run `npm run check` and confirm zero TypeScript errors; both must be clean

**Checkpoint**: User Stories 1 AND 2 are both independently functional — all 5 functions pass their full test suites

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final contract verification, TypeScript hygiene, and export boundary enforcement.

- [X] T012 [P] Audit `src/lib/calculator.ts` named exports against `specs/001-simple-calculator/contracts/calculator-api.ts`: confirm exactly **5** exported functions (`add`, `subtract`, `multiply`, `divide`, `sinDeg`); confirm **no default export**; confirm `cos`, `tan`, `cot`, and any other trig function are **absent** (FR-006, SC-005); confirm JSDoc block comments are present on each export per the contract file; fix any discrepancy found
- [X] T013 [P] Verify the import path in `tests/unit/calculator.test.ts` uses the `.js` extension (`'../../../src/lib/calculator.js'`) as required by NodeNext ESM resolution (R-006); run `npm run check` as the final full-project TypeScript strict-mode gate; resolve any remaining type errors
- [X] T014 Run quickstart.md smoke test: execute the following via `node --input-type=module` or `tsx` to confirm live runtime behaviour matches documented examples — `divide(1, 3)` → `0.3333`; `sinDeg(45)` → `0.7071`; `sinDeg(180)` → `0`; `divide(7, 0)` throws `Error`; `add(null, 5)` throws `TypeError` with message matching `"expected a finite number"`; `add(Number.MAX_SAFE_INTEGER + 1, 0)` throws `RangeError`

**Checkpoint**: All success criteria (SC-001 through SC-005) validated — feature is shippable

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational) — blocked until T001 complete
        ├── Phase 3 (US1 Arithmetic) — blocked until T002 complete
        └── Phase 4 (US2 Sine)       — blocked until T002 complete AND Phase 3 complete
              └── Phase 5 (Polish)   — blocked until T011 complete
```

### User Story Dependencies

| Story | Depends on | Can start after |
|-------|-----------|----------------|
| US1 — Basic Arithmetic | Phase 2 (T002) | Module skeleton with helpers exists |
| US2 — Sine Function | Phase 2 (T002) + Phase 3 complete (T008 green) | All arithmetic tests pass |

> **Note**: US2 depends on Phase 3 being complete rather than just Phase 2, because `sinDeg` reuses the same `assertNumber` and `formatResult` helpers validated through US1 testing, and the test file is shared — adding US2 tests to a broken US1 test file would obscure failures.

### Within Each User Story

1. Tests written first (and must **fail** before implementation)
2. Each function implemented sequentially in the same file
3. Full test + type-check run as final checkpoint before moving on

---

## Parallel Opportunities

### Phase 1

Only one task — no parallelism.

### Phase 2

Only one task — no parallelism.

### Phase 3 (US1)

```
# T003 must be written and failing first, then T004–T007 can be done in
# any order (sequential edits to the same file):
T004 → add()
T005 → subtract()     ← any order among T004–T007
T006 → multiply()
T007 → divide()
# T008 runs last — gates on all four passing
```

### Phase 4 (US2)

```
T009 (sinDeg tests)  →  T010 (sinDeg impl)  →  T011 (verify green)
```

### Phase 5 (Polish)

```
T012 [P] (export audit)   ─┐
T013 [P] (TS check)        ├── run in parallel
                           └── T014 (smoke test) runs after T012+T013 confirm clean
```

---

## Parallel Example: Phase 5

```bash
# Run simultaneously (different concerns, read-only or isolated):
Task: "Audit src/lib/calculator.ts named exports against contracts/calculator-api.ts"  [T012]
Task: "Verify NodeNext .js import extension and run npm run check"                     [T013]

# Run after both are green:
Task: "Run quickstart.md smoke test via node --input-type=module"                      [T014]
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup → `npm test` runs
2. Complete Phase 2: Foundational → helpers in place, `npm run check` clean
3. Complete Phase 3: US1 → all arithmetic tests green
4. **STOP and VALIDATE** → `add`, `subtract`, `multiply`, `divide` work correctly; ship or demo
5. Continue to Phase 4 only when US1 is accepted

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 (Phase 3) → arithmetic MVP; independently shippable
3. US2 (Phase 4) → sine extension; independently testable
4. Polish (Phase 5) → contract + type gate; release-ready

### Single-Developer Sequence

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014
```

---

## Task Summary

| Phase | Tasks | Story | Count |
|-------|-------|-------|-------|
| Phase 1: Setup | T001 | — | 1 |
| Phase 2: Foundational | T002 | — | 1 |
| Phase 3: US1 Arithmetic | T003–T008 | US1 | 6 |
| Phase 4: US2 Sine | T009–T011 | US2 | 3 |
| Phase 5: Polish | T012–T014 | — | 3 |
| **Total** | | | **14** |

### Parallel Opportunities

- Phase 5: T012 and T013 can run simultaneously (2 parallel tasks)
- T004–T007 (US1 implementations) are in the same file and must be sequential edits, but require no blocking dependency between them beyond T002 completing

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3** (T001–T008) — delivers a fully functional arithmetic calculator library with Vitest test coverage, zero runtime dependencies, and clean TypeScript types.

### Format Validation

All 14 tasks follow the required checklist format:
- ✅ Every task starts with `- [ ]`
- ✅ Every task has a sequential ID (T001–T014)
- ✅ `[P]` applied only where tasks touch different files or are read-only (T012, T013)
- ✅ `[US1]` / `[US2]` labels on all user-story-phase tasks
- ✅ Setup and Foundational phase tasks have no story label
- ✅ Polish phase tasks have no story label
- ✅ Every task includes an exact file path or explicit command
