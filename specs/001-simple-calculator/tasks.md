# Tasks: TC-5 Simple Calculator

**Feature Branch**: `001-simple-calculator`
**Spec**: `specs/001-simple-calculator/spec.md`
**Plan**: `specs/001-simple-calculator/plan.md`
**Jira**: TC-5

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Create the directory scaffold so subsequent tasks have a place to land.

- [x] T001 Create directories `src/calculator/` and `tests/calculator/`

**Checkpoint**: Directory structure exists; implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Define the shared `CalculatorError` class and the internal `assertFinite` guard. All three user stories depend on these constructs — no story implementation task can begin until this phase is complete.

**⚠️ CRITICAL**: US1, US2, and US3 all import `CalculatorError`; this phase MUST be complete first.

- [x] T002 Create `src/calculator/calculator.ts` with exported `CalculatorError extends Error` class (sets `this.name = 'CalculatorError'` in constructor) and a non-exported `assertFinite(value: number, name: string): void` helper that throws `CalculatorError` with message `"Argument '<name>' must be a finite number, got <value>"` when `typeof value !== 'number' || !isFinite(value)`. Add JSDoc to both symbols. Export only `CalculatorError` at this stage; leave arithmetic and trig exports for later phases.

**Checkpoint**: `npm run check` exits 0. Foundation ready — all user story phases can now begin.

---

## Phase 3: User Story 1 — Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Expose `add`, `subtract`, `multiply`, and `divide` as named exports that return correct numeric results for all valid finite inputs.

**Independent Test**: Call each of the four functions with known finite inputs and assert the return value equals the expected result. No division-by-zero or non-finite inputs are needed to validate this story on its own.

### Tests for User Story 1

> **Write these tests BEFORE or ALONGSIDE implementation. Confirm they compile and FAIL (or show TODO) before T004 is merged.**

- [x] T003 [P] [US1] Create `tests/calculator/calculator.test.ts` with `node:test` / `node:assert/strict` test groups for US1 happy paths: `add(2, 3) === 5`, `add(-1, -1) === -2`, `add(0, 0) === 0`; `subtract(5, 3) === 2`, `subtract(3, 5) === -2`; `multiply(3, 4) === 12`, `multiply(5, 0) === 0`; `divide(10, 4) === 2.5`, `divide(9, 3) === 3`. Use `import { add, subtract, multiply, divide } from '../../src/calculator/calculator.js'`.

### Implementation for User Story 1

- [x] T004 [P] [US1] Implement `add(a, b)`, `subtract(a, b)`, `multiply(a, b)`, and `divide(a, b)` exported functions in `src/calculator/calculator.ts`. Each must call `assertFinite` for both operands before computing. `add` returns `a + b`; `subtract` returns `a - b`; `multiply` returns `a * b`; `divide` returns `a / b` (zero-guard added in US2). Add JSDoc to each export.

**Checkpoint**: Run `node --import tsx/esm --test tests/calculator/calculator.test.ts`. All US1 test cases pass. `npm run check` exits 0. User Story 1 is fully functional and independently verifiable.

---

## Phase 4: User Story 2 — Division by Zero Protection (Priority: P2)

**Goal**: Extend `divide` to throw a descriptive `CalculatorError` whenever the divisor is `0`, including the `0 ÷ 0` case. Non-finite inputs to any arithmetic function should also throw (the `assertFinite` guard from T004 already handles this for individual args; this phase adds the explicit zero-divisor check).

**Independent Test**: Call `divide(5, 0)` and `divide(0, 0)`. Assert that each throws an instance of `CalculatorError` with a message containing `"Division by zero"`. Assert that no call ever returns `Infinity` or `NaN`.

### Tests for User Story 2

- [x] T005 [P] [US2] Add a `'divide — division by zero'` test group to `tests/calculator/calculator.test.ts`: assert `divide(5, 0)` throws `CalculatorError` with message matching `/division by zero/i`; assert `divide(0, 0)` throws `CalculatorError`; assert `divide(-1, 0)` throws `CalculatorError`. Add a `'arithmetic — non-finite inputs'` test group: assert `add(Infinity, 1)` throws `CalculatorError`; assert `subtract(NaN, 2)` throws `CalculatorError`; assert `multiply(1, NaN)` throws `CalculatorError`; assert `divide(Infinity, 2)` throws `CalculatorError`.

### Implementation for User Story 2

- [x] T006 [US2] In `src/calculator/calculator.ts`, add a zero-divisor guard inside `divide`: after the two `assertFinite` calls, add `if (b === 0) throw new CalculatorError('Division by zero is not allowed')`. This single line completes US2 — the existing `assertFinite` guard already rejects `Infinity` and `NaN` inputs across all arithmetic functions.

**Checkpoint**: Run `node --import tsx/esm --test tests/calculator/calculator.test.ts`. All US1 and US2 test cases pass. `divide(x, 0)` never returns `Infinity` or `NaN`. `npm run check` exits 0.

---

## Phase 5: User Story 3 — Sine Trigonometric Function (Priority: P3)

**Goal**: Expose a `sin(radians)` named export that delegates to `Math.sin` for valid finite inputs, and throws `CalculatorError` for non-finite inputs (`Infinity`, `-Infinity`, `NaN`).

**Independent Test**: Call `sin(0)` and assert result is `0`; call `sin(Math.PI / 2)` and assert `Math.abs(result - 1) < 1e-10`; call `sin(Math.PI)` and assert `Math.abs(result) < 1e-10`; call `sin(-Math.PI / 2)` and assert `Math.abs(result + 1) < 1e-10`; call `sin(Infinity)` and assert it throws `CalculatorError`.

### Tests for User Story 3

- [x] T007 [P] [US3] Add a `'sin'` test group to `tests/calculator/calculator.test.ts`: `sin(0) === 0` (strictEqual); `Math.abs(sin(Math.PI / 2) - 1) < 1e-10` (ok); `Math.abs(sin(Math.PI)) < 1e-10` (ok); `sin(-Math.PI / 2)` result is approximately `-1` (ok); `sin(1e9)` result is within `[-1, 1]` (ok). Add a `'sin — invalid inputs'` group: `sin(Infinity)` throws `CalculatorError`; `sin(-Infinity)` throws `CalculatorError`; `sin(NaN)` throws `CalculatorError`. Add `sin` to the import line at the top of the test file.

### Implementation for User Story 3

- [x] T008 [P] [US3] Add exported `sin(radians: number): number` function to `src/calculator/calculator.ts`. Call `assertFinite(radians, 'radians')` first, then return `Math.sin(radians)`. Add JSDoc noting the argument is in radians. Add `sin` to the module's exports list.

**Checkpoint**: Run `node --import tsx/esm --test tests/calculator/calculator.test.ts`. All US1, US2, and US3 test cases pass. `npm run check` exits 0. All three user stories are independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Wire the convenience npm script and perform a final typecheck to confirm the whole module is production-ready.

- [x] T009 Add `"test:calculator": "node --import tsx/esm --test tests/calculator/calculator.test.ts"` to the `scripts` block in `package.json`. This is additive — no existing script is modified.

- [x] T010 Run `npm run check` and confirm it exits 0 with zero diagnostic messages. Run `npm run test:calculator` and confirm all tests pass. Fix any remaining type errors or test failures before considering the feature complete.

**Checkpoint (Definition of Done)**:
- `src/calculator/calculator.ts` exports `CalculatorError`, `add`, `subtract`, `multiply`, `divide`, `sin` with JSDoc
- `tests/calculator/calculator.test.ts` covers FR-001 through FR-011
- `npm run test:calculator` exits 0, all test cases green
- `npm run check` exits 0, zero TypeScript errors
- No new npm dependencies added

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─▶ Phase 2 (Foundational) ── BLOCKS all user stories
        ├─▶ Phase 3 (US1 — Basic Arithmetic)  ← MVP stop point
        │     └─▶ Phase 4 (US2 — Division by Zero)
        │           └─▶ Phase 5 (US3 — Sine)
        │                 └─▶ Phase 6 (Polish)
        └─▶ (US2 and US3 can also start after Phase 2 if staffed in parallel)
```

### User Story Dependencies

| Story | Depends on | Can start after |
|---|---|---|
| US1 (P1) | Phase 2 complete | T002 |
| US2 (P2) | Phase 2 + US1 implementation | T004 (divide exists to add guard) |
| US3 (P3) | Phase 2 complete | T002 (independent of US1/US2) |

> **US3 is independent of US1/US2** — `sin` is a unary function that only needs `assertFinite`. A parallel team could implement US3 concurrently with US1 after T002 is merged.

### Within Each Phase

- Tests (T003, T005, T007) and implementation (T004, T006, T008) tasks marked [P] target **different files** and can proceed concurrently by different developers
- The test file imports from `calculator.ts`, so the module file must at minimum exist as a stub for TypeScript to resolve imports

---

## Parallel Execution Examples

### Parallel: Phase 3 (US1)

```bash
# Both tasks target different files — launch concurrently:
Task A: T003 — Create tests/calculator/calculator.test.ts with US1 test cases
Task B: T004 — Implement add/subtract/multiply/divide in src/calculator/calculator.ts
```

### Parallel: Phase 4 + Phase 5 (after US1 merges)

```bash
# US2 and US3 test + implementation tasks target the same two files but can be
# batched per developer:
Developer A: T005 (US2 tests) → T006 (US2 implementation)
Developer B: T007 (US3 tests) → T008 (US3 implementation)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002) — **CRITICAL, blocks everything**
3. Complete Phase 3: US1 (T003 + T004)
4. **STOP AND VALIDATE**: `npm run test:calculator` green, `npm run check` clean
5. US1 is a complete, shippable calculator — ship if deadline pressure demands it

### Incremental Delivery

| Stage | Tasks | Deliverable |
|---|---|---|
| Foundation | T001–T002 | Error type + guard, typecheck clean |
| MVP | T003–T004 | Working 4-operation calculator, tested |
| +Error safety | T005–T006 | Zero-division protected, tested |
| +Trig | T007–T008 | `sin` added, tested |
| +DX | T009–T010 | `npm run test:calculator` wired, final check |

---

## Summary

| Metric | Value |
|---|---|
| Total tasks | 10 |
| US1 tasks | 2 (T003, T004) |
| US2 tasks | 2 (T005, T006) |
| US3 tasks | 2 (T007, T008) |
| Setup / Foundational tasks | 2 (T001, T002) |
| Polish tasks | 2 (T009, T010) |
| Parallelizable tasks [P] | 5 (T003, T004, T005, T007, T008) |
| New files | 2 (`src/calculator/calculator.ts`, `tests/calculator/calculator.test.ts`) |
| Modified files | 1 (`package.json` — additive script only) |
| New dependencies | 0 |
| Suggested MVP scope | Phase 1 + Phase 2 + Phase 3 (T001–T004) |
