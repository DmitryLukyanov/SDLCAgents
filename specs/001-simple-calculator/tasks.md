---

description: "Task list for Simple Calculator feature"
---

# Tasks: Simple Calculator

**Input**: Design documents from `/specs/001-simple-calculator/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: Included — the plan explicitly defines test coverage for all acceptance scenarios via a `tsx`-driven test runner.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every description

---

## Phase 1: Setup (Directory Structure)

**Purpose**: Create the source and test directories that house the calculator module and its companion test file.

- [ ] T001 Create directory `src/calculator/` (per plan.md project structure)
- [ ] T002 [P] Create directory `tests/calculator/` (per plan.md project structure)

**Checkpoint**: Both directories exist and are ready to receive implementation files.

---

## Phase 2: Foundational (Calculator Module)

**Purpose**: Implement the single TypeScript module that exposes all five named exports and the shared input guard. This file is the prerequisite for **all** user-story test work.

**⚠️ CRITICAL**: No user-story test phases can begin until this phase is complete and passes `tsc --noEmit`.

- [ ] T003 Implement shared `assertFiniteNumber(value: unknown, name: string): void` helper (throws descriptive `Error` for `NaN`, `±Infinity`, non-`number` types) in `src/calculator/calculator.ts`
- [ ] T004 Implement and export `add(a: number, b: number): number` that validates both inputs via `assertFiniteNumber` then returns `a + b` in `src/calculator/calculator.ts`
- [ ] T005 Implement and export `subtract(a: number, b: number): number` that validates both inputs via `assertFiniteNumber` then returns `a - b` in `src/calculator/calculator.ts`
- [ ] T006 Implement and export `multiply(a: number, b: number): number` that validates both inputs via `assertFiniteNumber` then returns `a * b` in `src/calculator/calculator.ts`
- [ ] T007 Implement and export `divide(a: number, b: number): number` that validates both inputs via `assertFiniteNumber`, throws `'Division by zero: divisor "b" must not be 0'` when `b === 0`, then returns `a / b` in `src/calculator/calculator.ts`
- [ ] T008 Implement and export `sin(angle: number): number` that validates input via `assertFiniteNumber` then delegates to `Math.sin(angle)` in `src/calculator/calculator.ts`
- [ ] T009 Run `tsc --noEmit` and confirm zero type errors for `src/calculator/calculator.ts`

**Checkpoint**: `src/calculator/calculator.ts` is fully implemented, type-checks cleanly, and all five functions are exported as ESM named exports. User-story test phases can now begin.

---

## Phase 3: User Story 1 — Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Verify that `add`, `subtract`, `multiply`, and `divide` return correct results for valid inputs and throw correct errors for invalid inputs and division by zero.

**Independent Test**: Import the calculator module and assert return values against expected results for each arithmetic function; confirm error throws for invalid inputs and `divide(7, 0)`.

### Tests for User Story 1

- [ ] T010 [US1] Create `tests/calculator/calculator.test.ts` with a minimal `assert` helper, a `test(name, fn)` runner that tracks pass/fail counts, and a final summary that exits with code `1` on any failure
- [ ] T011 [US1] Add `add` test cases to `tests/calculator/calculator.test.ts`: `add(3, 4) → 7`, `add(-1, 1) → 0`, `add(0, 0) → 0`, `add(Number.MAX_SAFE_INTEGER, 1) → correct IEEE 754 result`
- [ ] T012 [US1] Add `subtract` test cases to `tests/calculator/calculator.test.ts`: `subtract(10, 3) → 7`, `subtract(0, 5) → -5`, `subtract(-3, -3) → 0`
- [ ] T013 [US1] Add `multiply` test cases to `tests/calculator/calculator.test.ts`: `multiply(4, 5) → 20`, `multiply(0, 99) → 0`, `multiply(-3, 4) → -12`
- [ ] T014 [US1] Add `divide` test cases to `tests/calculator/calculator.test.ts`: `divide(10, 2) → 5`, `divide(-6, 3) → -2`, `divide(7, 0) → throws`, `divide(1, 3) → correct IEEE 754 result`
- [ ] T015 [US1] Add invalid-input test cases for arithmetic functions to `tests/calculator/calculator.test.ts`: `add(NaN, 1) → throws`, `subtract(1, Infinity) → throws`, `multiply(-Infinity, 2) → throws`, `divide(undefined as unknown as number, 1) → throws`
- [ ] T016 [US1] Run `npx tsx tests/calculator/calculator.test.ts` and confirm exit code `0` with all arithmetic tests passing

**Checkpoint**: User Story 1 is fully functional and independently verifiable. All arithmetic acceptance scenarios from spec.md pass.

---

## Phase 4: User Story 2 — Sine Trigonometric Operation (Priority: P2)

**Goal**: Verify that `sin` returns mathematically correct results for known radian inputs within `1e-10` absolute tolerance and throws correct errors for invalid inputs.

**Independent Test**: Call `sin(angle)` with known radian values (`0`, `Math.PI / 2`, `Math.PI`, `-Math.PI / 2`) and compare output to reference values within `1e-10` tolerance; confirm error throw for non-numeric input.

### Tests for User Story 2

- [ ] T017 [US2] Add `sin` acceptance test cases to `tests/calculator/calculator.test.ts` using `|result - expected| < 1e-10` tolerance: `sin(0) ≈ 0`, `sin(Math.PI / 2) ≈ 1`, `sin(Math.PI) ≈ 0`, `sin(-Math.PI / 2) ≈ -1`
- [ ] T018 [US2] Add invalid-input test cases for `sin` to `tests/calculator/calculator.test.ts`: `sin(NaN) → throws`, `sin(Infinity) → throws`, `sin(-Infinity) → throws`, `sin("45" as unknown as number) → throws`
- [ ] T019 [US2] Run `npx tsx tests/calculator/calculator.test.ts` and confirm exit code `0` with all arithmetic and sine tests passing

**Checkpoint**: User Stories 1 AND 2 are both fully functional and independently verifiable. All acceptance scenarios from spec.md pass, including SC-004 floating-point tolerance.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Wire the test runner into `package.json`, run the final typecheck over both source and test files, and confirm the module's public API is exactly the five specified exports.

- [ ] T020 Add `"calculator:test": "tsx tests/calculator/calculator.test.ts"` script to `package.json` (consistent with existing script patterns such as `scrum-master:debug`)
- [ ] T021 Run `tsc --noEmit` covering both `src/calculator/calculator.ts` and `tests/calculator/calculator.test.ts` and confirm zero type errors
- [ ] T022 [P] Verify the public API of `src/calculator/calculator.ts` exposes exactly five named exports (`add`, `subtract`, `multiply`, `divide`, `sin`) and no additional symbols (SC-005)
- [ ] T023 [P] Run `npm run calculator:test` and confirm exit code `0` (end-to-end validation using the `package.json` script)

**Checkpoint**: Codebase is type-clean, fully tested, and the calculator module is ready for consumer use.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user-story phases**
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T009 passing) — no dependency on US2
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T009 passing) — no dependency on US1, but appends to the test file created in Phase 3, so sequential after Phase 3 is simplest
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 both complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational phase — no cross-story dependencies
- **User Story 2 (P2)**: Starts after Foundational phase — logically independent; builds on the same module without altering US1 behaviour

### Within Each User Story

- Test scaffold (T010) before individual test cases (T011–T015)
- All test cases for the story before the run-and-verify step (T016 / T019)
- Story verified (exit 0) before moving to the next priority

### Parallel Opportunities

- T001 and T002 (directory creation) can run in parallel
- T003–T008 (function implementations) can be worked in parallel by different developers against the same file, then merged before T009
- T011–T015 (US1 test cases) can be drafted in parallel and appended to the test file
- T017–T018 (US2 test cases) can be drafted in parallel and appended to the test file
- T022 and T023 (final validations in Phase 5) are independent and can run in parallel

---

## Parallel Example: User Story 1 Test Cases

```bash
# Draft these test blocks in parallel (different developers, same file):
Task T011: "Add test cases for add() in tests/calculator/calculator.test.ts"
Task T012: "Add test cases for subtract() in tests/calculator/calculator.test.ts"
Task T013: "Add test cases for multiply() in tests/calculator/calculator.test.ts"
Task T014: "Add test cases for divide() in tests/calculator/calculator.test.ts"
Task T015: "Add invalid-input test cases in tests/calculator/calculator.test.ts"

# Then run together:
Task T016: "npx tsx tests/calculator/calculator.test.ts → exit 0"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational — implement and typecheck `calculator.ts` (T003–T009)
3. Complete Phase 3: User Story 1 — write and verify arithmetic tests (T010–T016)
4. **STOP and VALIDATE**: `add`, `subtract`, `multiply`, `divide` are independently testable
5. Ship as MVP if needed

### Incremental Delivery

1. Phase 1 + Phase 2 → Module ready
2. Phase 3 → Arithmetic verified (**MVP delivered**)
3. Phase 4 → Sine verified (feature complete)
4. Phase 5 → Package wired, final typecheck, API surface confirmed

### Solo Developer Strategy

Work phases sequentially top-to-bottom. Within Phase 2, implement functions in the order listed (T003 → T004 → T005 → T006 → T007 → T008 → T009) to keep the file growing incrementally and type-cleanly.

---

## Notes

- `[P]` tasks operate on different files or independent sections and have no blocking inter-dependencies
- `[US1]` / `[US2]` labels map each task to the user story from `spec.md` for full traceability
- The `.js` extension must be used in the test file's import path (`../../src/calculator/calculator.js`) due to `NodeNext` module resolution — this is correct for TypeScript ESM projects
- No external test framework is introduced; the `tsx` runner pattern is consistent with the existing `scrum-master:debug` script
- All five functions live in a **single file** — no sub-module splitting is needed or desired
- Commit once after T023 confirms everything is green: all files, scripts, and typecheck in one atomic commit
