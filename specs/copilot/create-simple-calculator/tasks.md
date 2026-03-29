# Tasks: Simple Calculator Library

**Input**: Design documents from `/specs/copilot/create-simple-calculator/`  
**Spec**: `/specs/copilot-create-simple-calculator/spec.md`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/calculator-api.md ✅

**Tests**: Included — the spec and plan explicitly define test files and success criteria requiring automated unit tests (SC-001 through SC-006).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Basic Arithmetic, US2 = Sine Function)
- All paths are absolute from repository root: `/home/runner/work/SDLCAgents/SDLCAgents/`

---

## Phase 1: Setup

**Purpose**: Create the new source and test files so subsequent tasks have a target to work in.

- [ ] T001 Create `src/lib/calculator.ts` with the bare module skeleton: five placeholder exports (`add`, `subtract`, `multiply`, `divide`, `sin`) typed as `(…args: number[]) => number`, no implementations yet
- [ ] T002 [P] Create `tests/calculator/arithmetic.test.ts` as an empty Node.js `node:test` test file (import `{ test }` from `'node:test'` and `{ strict }` from `'node:assert'`; no test cases yet)
- [ ] T003 [P] Create `tests/calculator/sin.test.ts` as an empty Node.js `node:test` test file (same imports as T002; no test cases yet)

**Checkpoint**: Both source and test files exist; `npx tsc --noEmit` reports no errors on the skeletons.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: The shared `assertNumber` input guard is called by every exported function. It must be in place before any function is implemented.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [ ] T004 Implement the internal `assertNumber(value: unknown, name: string): asserts value is number` guard in `src/lib/calculator.ts` — throw `TypeError` with message `"Argument '<name>' must be a valid number; received <type>."` when `typeof value !== 'number'` or `Number.isNaN(value)`; do **not** export it

**Checkpoint**: `assertNumber` is in place; a quick manual call `assertNumber(NaN, 'x')` throws `TypeError`; `assertNumber(Infinity, 'x')` does **not** throw.

---

## Phase 3: User Story 1 — Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Export `add`, `subtract`, `multiply`, and `divide` as fully validated, stateless named functions that any JavaScript/TypeScript caller can import and invoke directly.

**Independent Test**: Import the library and call each of the four arithmetic functions with known inputs; assert correct numeric return values and correct error throwing — no other story required.

### Tests for User Story 1 ⚠️ Write & Confirm Failing BEFORE Implementing

- [ ] T005 [US1] Write all arithmetic unit tests in `tests/calculator/arithmetic.test.ts` covering:
  - `add(8, 5) === 13`, `add(0.1, 0.2)` (float64 result), `add(Infinity, 1) === Infinity`
  - `subtract(10, 4) === 6`, `subtract(0, 5) === -5`
  - `multiply(6, 7) === 42`, `multiply(-3, 4) === -12`
  - `divide(15, 4) === 3.75`, `divide(0, 5) === 0`
  - `divide(9, 0)` throws `Error` with message matching `"Division by zero"`
  - `add(NaN, 5)`, `add('8' as any, 5)`, `divide(9, NaN)` each throw `TypeError` with a message matching `"must be a valid number"`
  - Post-error isolation: after `divide(9, 0)` throws, `add(1, 1) === 2` succeeds (SC-006)
- [ ] T006 [US1] Run tests and confirm they **fail** (functions not yet implemented): `node --import tsx/esm --test tests/calculator/arithmetic.test.ts`

### Implementation for User Story 1

- [ ] T007 [US1] Implement `add(a: number, b: number): number` in `src/lib/calculator.ts` — call `assertNumber` on both arguments, return `a + b`
- [ ] T008 [US1] Implement `subtract(a: number, b: number): number` in `src/lib/calculator.ts` — call `assertNumber` on both arguments, return `a - b`
- [ ] T009 [US1] Implement `multiply(a: number, b: number): number` in `src/lib/calculator.ts` — call `assertNumber` on both arguments, return `a * b`
- [ ] T010 [US1] Implement `divide(a: number, b: number): number` in `src/lib/calculator.ts` — call `assertNumber` on both arguments, then if `b === 0` throw `new Error('Division by zero: divisor must not be 0.')`, else return `a / b`
- [ ] T011 [US1] Run arithmetic tests and confirm they all **pass**: `node --import tsx/esm --test tests/calculator/arithmetic.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable. All four arithmetic functions work correctly. Division by zero and invalid inputs throw descriptive errors. Subsequent calls after errors succeed normally.

---

## Phase 4: User Story 2 — Sine Function Calculation (Priority: P2)

**Goal**: Export a `sin(x)` function that accepts an angle in **radians**, delegates to `Math.sin`, and validates input with `assertNumber`. No other trigonometric functions are exposed.

**Independent Test**: Import the library, call `sin` with known radian values, assert results match `Math.sin` to float64 precision; assert `cos`, `tan`, `cot` are not exported — no other story required.

### Tests for User Story 2 ⚠️ Write & Confirm Failing BEFORE Implementing

- [ ] T012 [US2] Write all sine unit tests in `tests/calculator/sin.test.ts` covering:
  - `sin(0) === 0`
  - `Math.abs(sin(Math.PI / 2) - 1) < 1e-10` (within float64 precision)
  - `Math.abs(sin(Math.PI / 6) - 0.5) < 1e-10`
  - `sin(Infinity)` returns `NaN` (delegated IEEE 754 semantics from `Math.sin`)
  - `sin('π/2' as any)` throws `TypeError` with message matching `"must be a valid number"`
  - `sin(NaN)` throws `TypeError` with message matching `"must be a valid number"`
  - Absence of banned exports: assert `(calculator as any).cos === undefined`, same for `tan`, `cot` — import the whole module as a namespace for this check
- [ ] T013 [US2] Run tests and confirm they **fail** (`sin` not yet implemented): `node --import tsx/esm --test tests/calculator/sin.test.ts`

### Implementation for User Story 2

- [ ] T014 [US2] Implement `sin(x: number): number` in `src/lib/calculator.ts` — call `assertNumber(x, 'x')`, then return `Math.sin(x)`; confirm no `cos`, `tan`, or `cot` symbols are exported from the module
- [ ] T015 [US2] Run sine tests and confirm they all **pass**: `node --import tsx/esm --test tests/calculator/sin.test.ts`

**Checkpoint**: User Story 2 is fully functional and independently testable. The `sin` function returns correct radian results. Banned trigonometric functions (`cos`, `tan`, `cot`) are absent from the public API.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across both user stories.

- [ ] T016 [P] Add JSDoc comments to all five exported functions in `src/lib/calculator.ts` — each comment must document: parameter types, return value, thrown errors, and radian note for `sin`
- [ ] T017 [P] Run the full test suite and assert zero failures: `node --import tsx/esm --test tests/calculator/arithmetic.test.ts tests/calculator/sin.test.ts`
- [ ] T018 Run TypeScript type-check with zero errors: `npx tsc --noEmit`
- [ ] T019 [P] Validate SC-005: confirm that a `grep` or module inspection reveals no `export` of `cos`, `tan`, or `cot` in `src/lib/calculator.ts`

**Checkpoint**: All 19 tasks complete; both user stories pass their tests; TypeScript is error-free; the module surface is clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002 and T003 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user story work
- **User Story 1 (Phase 3)**: Depends on Phase 2 — T005/T006 (tests) can start immediately after T004; T007–T010 (implementation) depend on T004 and follow the failing tests
- **User Story 2 (Phase 4)**: Depends on Phase 2 — can start after Phase 2 in parallel with Phase 3 if staffed
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 both being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T004) — no dependency on US2
- **User Story 2 (P2)**: Can start after Foundational (T004) — no dependency on US1 (the `assertNumber` guard is the only shared prerequisite)

### Within Each User Story

1. Write tests and confirm they **FAIL** (TDD gate)
2. Implement each function sequentially (all in `src/lib/calculator.ts`)
3. Run tests and confirm they **PASS**

### Parallel Opportunities

| Parallel Group | Tasks |
|---|---|
| Setup file creation | T002, T003 (different test files) |
| US1 test authoring ↔ US2 test authoring | T005 ↔ T012 (different files) |
| US1 implementation ↔ US2 tests | T007–T010 ↔ T012 (different concerns) |
| Polish tasks | T016, T017, T019 (independent) |

---

## Parallel Example: User Story 1

```bash
# Step 1 — Setup (T002, T003 in parallel):
Task A: "Create tests/calculator/arithmetic.test.ts skeleton"
Task B: "Create tests/calculator/sin.test.ts skeleton"

# Step 2 — Foundational (T004, sequential):
Task: "Implement assertNumber guard in src/lib/calculator.ts"

# Step 3 — US1 arithmetic tests first (T005, T006), then all four implementations (T007–T010):
Task: "Write and run failing arithmetic tests in tests/calculator/arithmetic.test.ts"
# Then sequentially in the same file:
Task: "Implement add, subtract, multiply, divide in src/lib/calculator.ts"
Task: "Confirm all arithmetic tests pass"
```

---

## Parallel Example: User Story 2

```bash
# After Foundational (T004) is complete:
# US1 and US2 can proceed in parallel if two developers are available

# Developer A:
Task T005: "Write arithmetic tests"
Task T006: "Confirm tests fail"
Task T007–T010: "Implement add, subtract, multiply, divide"
Task T011: "Confirm tests pass"

# Developer B (in parallel):
Task T012: "Write sine tests"
Task T013: "Confirm tests fail"
Task T014: "Implement sin"
Task T015: "Confirm tests pass"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004) — **CRITICAL, blocks all stories**
3. Complete Phase 3: User Story 1 (T005–T011)
4. **STOP and VALIDATE**: Run `node --import tsx/esm --test tests/calculator/arithmetic.test.ts` — all must pass
5. Ship MVP: `add`, `subtract`, `multiply`, `divide` are production-ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP shipped**
3. Add User Story 2 → Test independently → **Full feature shipped**
4. Polish → JSDoc + full suite + type-check

### Single-Developer Sequence (Recommended)

```
T001 → T002/T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016/T017/T019 → T018
```

### Parallel Team Strategy (Two Developers)

1. Both complete T001–T004 together (15 min total)
2. Dev A owns Phase 3 (US1 arithmetic); Dev B owns Phase 4 (US2 sine)
3. Both reconvene for Phase 5 polish

---

## Notes

- All tasks target two new files only: `src/lib/calculator.ts` and `tests/calculator/{arithmetic,sin}.test.ts`
- No new npm dependencies — `tsx` (already in devDependencies) handles TypeScript ESM test execution
- Test invocation: `node --import tsx/esm --test <file>` (from repository root)
- `[P]` tasks operate on different files or independent concerns — safe to parallelise
- `[Story]` labels (US1, US2) map directly to user stories in the spec
- Commit after each checkpoint to preserve incremental progress
- Each user story checkpoint is independently demo-able and deployable
