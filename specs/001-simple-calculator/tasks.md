---
description: "Task list for TC-5 Simple Calculator implementation"
feature: "001-simple-calculator"
spec: "specs/001-simple-calculator/spec.md"
plan: "specs/001-simple-calculator/plan.md"
generated: "2026-03-29"
---

# Tasks: Simple Calculator (TC-5)

**Input**: Design documents from `specs/001-simple-calculator/`  
**Spec**: `specs/001-simple-calculator/spec.md` | **Plan**: `specs/001-simple-calculator/plan.md`  
**Contract**: `specs/001-simple-calculator/contracts/calculator-api.md`  
**Data model**: `specs/001-simple-calculator/data-model.md`

**Tech stack**: TypeScript 5.7.2 · Node.js ≥ 20 · ESM NodeNext · `node:test` (built-in) · `tsx` (existing)  
**No new dependencies** — all tooling already present in `package.json`.

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependency)
- **[US1/US2/US3]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Wire up the test runner command and create the barrel entry point that all stories export through.

- [ ] T001 Add `"test:calculator"` script to `package.json`: `"node --import tsx/esm --test 'tests/calculator/**/*.test.ts'"`
- [ ] T002 Create `src/calculator/index.ts` as an empty barrel file with JSDoc module header (re-exports will be added per story)

**Checkpoint**: `npm run test:calculator` command exists; `src/calculator/index.ts` file exists (empty exports)

---

## Phase 2: Foundational (Blocking Prerequisites)

> No foundational phase required — this is a stateless pure-function library with no shared infrastructure beyond the barrel file created in Phase 1. User stories can begin immediately after Phase 1.

---

## Phase 3: User Story 1 — Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Deliver a working `arithmetic.ts` module exposing `add`, `subtract`, `multiply`, `divide` as named ESM exports, with division-by-zero protection.

**Independent Test**: Run `node --import tsx/esm --test tests/calculator/arithmetic.test.ts` — all cases pass with valid numeric inputs and division by zero throws `Error('Division by zero')`.

### Tests for User Story 1

> **Write tests FIRST — they must FAIL before T005 is implemented**

- [ ] T003 [P] [US1] Create `tests/calculator/arithmetic.test.ts`: import from `../../src/calculator/index.js`; cover `add`, `subtract`, `multiply`, `divide` happy-path cases (positive, negative, zero, float operands) using `node:test` + `node:assert/strict`
- [ ] T004 [P] [US1] Add division-by-zero test case to `tests/calculator/arithmetic.test.ts`: assert `divide(10, 0)` throws an `Error` whose `.message` is exactly `'Division by zero'`

### Implementation for User Story 1

- [ ] T005 [US1] Create `src/calculator/arithmetic.ts` with JSDoc module header; implement `add(a, b)`, `subtract(a, b)`, `multiply(a, b)` as named exports returning `a OP b` directly (no validation yet — validation is US3)
- [ ] T006 [US1] Add `divide(a, b)` to `src/calculator/arithmetic.ts`: check `b === 0` **before** dividing and throw `new Error('Division by zero')`; return `a / b` otherwise
- [ ] T007 [US1] Re-export `{ add, subtract, multiply, divide }` from `src/calculator/index.ts` using `export { ... } from './arithmetic.js'`
- [ ] T008 [US1] Run `node --import tsx/esm --test tests/calculator/arithmetic.test.ts` and confirm all tests pass; fix any failures before proceeding

**Checkpoint**: `add`, `subtract`, `multiply`, `divide` are importable from `src/calculator/index.js`; arithmetic tests are green; `divide(n, 0)` throws.

---

## Phase 4: User Story 2 — Sine Function (Priority: P2)

**Goal**: Deliver `trigonometry.ts` exposing `sin` as a named ESM export, wrapping `Math.sin` and correctly propagating `NaN` for non-finite inputs.

**Independent Test**: Run `node --import tsx/esm --test tests/calculator/trigonometry.test.ts` — `sin(0)` = 0, `sin(Math.PI/2)` ≈ 1, `sin(Math.PI)` ≈ 0, `sin(-Math.PI/2)` ≈ -1, `sin(Infinity)` = `NaN`.

### Tests for User Story 2

> **Write tests FIRST — they must FAIL before T010 is implemented**

- [ ] T009 [P] [US2] Create `tests/calculator/trigonometry.test.ts`: import `sin` from `../../src/calculator/index.js`; cover `sin(0)`, `sin(Math.PI / 2)` (use `assert.ok(Math.abs(result - 1) < 1e-10)`), `sin(Math.PI)` (≈ 0 with tolerance), `sin(-Math.PI / 2)` (≈ -1), and `sin(Infinity)` → `NaN` (use `assert.ok(Number.isNaN(result))`)

### Implementation for User Story 2

- [ ] T010 [US2] Create `src/calculator/trigonometry.ts` with JSDoc module header; implement `sin(x: number): number` as a named export returning `Math.sin(x)` (no branching needed — `Math.sin(Infinity)` naturally returns `NaN` per IEEE 754)
- [ ] T011 [US2] Re-export `{ sin }` from `src/calculator/index.ts` by adding `export { sin } from './trigonometry.js'`
- [ ] T012 [US2] Run `node --import tsx/esm --test tests/calculator/trigonometry.test.ts` and confirm all tests pass; fix any failures before proceeding

**Checkpoint**: `sin` is importable from `src/calculator/index.js`; trig tests are green; `sin(Infinity)` returns `NaN` without throwing.

---

## Phase 5: User Story 3 — Error Handling & Invalid Input (Priority: P3)

**Goal**: Protect all five functions from non-numeric inputs by adding runtime `typeof` guards that throw descriptive `Error` objects matching the API contract exactly.

**Independent Test**: Non-numeric values (strings, `undefined`, `null`, booleans, objects) passed to any function cause a thrown `Error` with message `Argument "<param>" must be a number, got <typeof value>`. No silent `NaN` or `undefined` is produced.

**Error message contract** (from `specs/001-simple-calculator/contracts/calculator-api.md`):

| Scenario | Exact message |
|----------|---------------|
| Non-numeric `a` | `Argument "a" must be a number, got <typeof a>` |
| Non-numeric `b` | `Argument "b" must be a number, got <typeof b>` |
| Non-numeric `x` | `Argument "x" must be a number, got <typeof x>` |
| Division by zero | `Division by zero` *(already implemented in T006)* |

### Tests for User Story 3

> **Write tests FIRST** — with guards not yet added, these tests will fail (functions silently return `NaN` for non-numeric input)

- [ ] T013 [P] [US3] Add non-numeric input test cases to `tests/calculator/arithmetic.test.ts`: for each of `add`, `subtract`, `multiply`, `divide` pass a string as `a` and assert throw with message `'Argument "a" must be a number, got string'`; also test passing `undefined` as `b` for at least one function
- [ ] T014 [P] [US3] Add non-numeric input test case to `tests/calculator/trigonometry.test.ts`: call `sin('0' as unknown as number)` and assert throw with message `'Argument "x" must be a number, got string'`

### Implementation for User Story 3

- [ ] T015 [US3] Add typeof guard helper (inline, not a separate file) to `src/calculator/arithmetic.ts`: at the top of each of `add`, `subtract`, `multiply`, `divide` check `typeof a !== 'number'` → throw `new Error(\`Argument "a" must be a number, got \${typeof a}\`)` and `typeof b !== 'number'` → throw `new Error(\`Argument "b" must be a number, got \${typeof b}\`)`; guards must run **before** the division-by-zero check in `divide`
- [ ] T016 [US3] Add typeof guard to `sin` in `src/calculator/trigonometry.ts`: check `typeof x !== 'number'` → throw `new Error(\`Argument "x" must be a number, got \${typeof x}\`)`
- [ ] T017 [US3] Run full test suite `node --import tsx/esm --test tests/calculator/arithmetic.test.ts tests/calculator/trigonometry.test.ts` and confirm all tests (including non-numeric cases) pass; fix any failures

**Checkpoint**: All five functions reject non-numeric inputs with the exact error messages specified in the contract. Full test suite is green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Type-check the entire project, confirm clean barrel exports, and validate the quickstart examples work.

- [ ] T018 [P] Run `npm run check` (`tsc --noEmit`) and fix any TypeScript strict-mode errors in `src/calculator/arithmetic.ts`, `src/calculator/trigonometry.ts`, and `src/calculator/index.ts`
- [ ] T019 [P] Review `src/calculator/index.ts` barrel: confirm it re-exports exactly `{ add, subtract, multiply, divide, sin }` and no accidental extra symbols; confirm `.js` extension is used on all import paths
- [ ] T020 Run `npm run test:calculator` (full suite via glob) and confirm all tests pass with exit code 0; output task count is complete

**Checkpoint**: `tsc --noEmit` exits 0; `npm run test:calculator` exits 0; barrel exports only the five contracted functions.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 3 (US1 — P1) ◄── MVP: can ship after this phase alone
        └─► Phase 4 (US2 — P2)
              └─► Phase 5 (US3 — P3)
                    └─► Phase 6 (Polish)
```

> US2 and US3 each build on prior files but add **new** files or **append** to existing ones — no story deletes prior work.

### User Story Dependencies

| Story | Depends on | Notes |
|-------|-----------|-------|
| **US1 (P1)** | Phase 1 only | Creates `arithmetic.ts` and `arithmetic.test.ts` from scratch |
| **US2 (P2)** | Phase 1 + US1 complete | Creates `trigonometry.ts` and `trigonometry.test.ts` from scratch; appends to `index.ts` |
| **US3 (P3)** | US1 + US2 complete | Edits all four existing files (adds guards + tests) |

### Within Each Story

1. Tests written first (TDD — fail before implementation)
2. Implementation task(s)
3. Barrel update (for US1, US2)
4. Verification run

### Parallel Opportunities per Story

**US1 (Phase 3)**:
```
T003 [create arithmetic.test.ts — happy paths]  ─┐
T004 [add div-by-zero test case]                 ─┘ (same file — T004 appends after T003)
  ↓ (both tests written)
T005 [implement add/subtract/multiply]  ─┐
T006 [implement divide + guard]         ─┘ could overlap but same file; keep sequential
  ↓
T007 [update index.ts barrel]
  ↓
T008 [run tests ✓]
```

**US2 (Phase 4)**:
```
T009 [create trigonometry.test.ts]  ← can start as soon as Phase 1 is done (different file from US1 tests)
  ↓
T010 [implement trigonometry.ts]
T011 [update index.ts barrel]
  ↓
T012 [run tests ✓]
```

**US3 (Phase 5)**:
```
T013 [add non-numeric tests to arithmetic.test.ts]  ─┐  parallel (different files)
T014 [add non-numeric test to trigonometry.test.ts]  ─┘
  ↓ (both test additions done)
T015 [add guards to arithmetic.ts]  ─┐  parallel (different files)
T016 [add guard to trigonometry.ts]  ─┘
  ↓
T017 [run full suite ✓]
```

**Polish (Phase 6)**:
```
T018 [tsc --noEmit]  ─┐  parallel (read-only checks)
T019 [review barrel]  ─┘
  ↓
T020 [npm run test:calculator ✓]
```

---

## Implementation Strategy

### MVP Scope (Recommended First Delivery)

Complete **Phase 1 + Phase 3 (US1)** only — this delivers a functional four-operation arithmetic calculator, fully tested, importable as a TypeScript ESM module. Tasks T001–T008 = MVP.

### Incremental Delivery Order

1. **MVP**: T001–T008 → arithmetic calculator working and tested
2. **+Sine**: T009–T012 → sine function added, all tests green
3. **+Validation**: T013–T017 → robust non-numeric input rejection
4. **+Polish**: T018–T020 → clean TypeScript compilation, full suite green

### File Creation vs. Edit Summary

| Task | File | Operation |
|------|------|-----------|
| T001 | `package.json` | Edit — add script |
| T002 | `src/calculator/index.ts` | **Create** (empty barrel) |
| T003 | `tests/calculator/arithmetic.test.ts` | **Create** |
| T004 | `tests/calculator/arithmetic.test.ts` | Edit — append test case |
| T005 | `src/calculator/arithmetic.ts` | **Create** |
| T006 | `src/calculator/arithmetic.ts` | Edit — add `divide` |
| T007 | `src/calculator/index.ts` | Edit — add arithmetic re-exports |
| T008 | *(verification)* | Run |
| T009 | `tests/calculator/trigonometry.test.ts` | **Create** |
| T010 | `src/calculator/trigonometry.ts` | **Create** |
| T011 | `src/calculator/index.ts` | Edit — add `sin` re-export |
| T012 | *(verification)* | Run |
| T013 | `tests/calculator/arithmetic.test.ts` | Edit — append non-numeric tests |
| T014 | `tests/calculator/trigonometry.test.ts` | Edit — append non-numeric test |
| T015 | `src/calculator/arithmetic.ts` | Edit — add typeof guards to all 4 functions |
| T016 | `src/calculator/trigonometry.ts` | Edit — add typeof guard to `sin` |
| T017 | *(verification)* | Run |
| T018 | *(verification)* | Run |
| T019 | `src/calculator/index.ts` | Review — no code change expected |
| T020 | *(verification)* | Run |

**Total source files created**: 4 (`index.ts`, `arithmetic.ts`, `trigonometry.ts`, `arithmetic.test.ts`, `trigonometry.test.ts`)  
**Total source files edited**: 3 (`package.json`, `index.ts` × 2 edits, `arithmetic.ts` × 2 edits, `trigonometry.ts` × 1 edit, test files × 2 edits)
