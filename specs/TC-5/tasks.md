# Tasks: Simple Calculator (TC-5)

**Input**: Design documents from `/specs/TC-5/`
**Prerequisites**: spec.md, plan.md

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create directory structure: `src/calculator/`, `tests/calculator/`

---

## Phase 2: User Story 1 – Basic Arithmetic Operations (Priority: P1) 🎯 MVP

**Goal**: Implement add, subtract, multiply, divide with division-by-zero guard.

**Independent Test**: Call each arithmetic function with known inputs and verify results.

### Tests for User Story 1

- [x] T002 [P] [US1] Write unit tests for add, subtract, multiply, divide (including divide-by-zero) in `tests/calculator/calculator.test.ts`

### Implementation for User Story 1

- [x] T003 [US1] Implement `CalculatorError` class and `add`, `subtract`, `multiply`, `divide` functions in `src/calculator/calculator.ts`

**Checkpoint**: User Story 1 fully functional and tested independently.

---

## Phase 3: User Story 2 – Sine Function (Priority: P2)

**Goal**: Extend the calculator with a `sin` function (radians).

**Independent Test**: Call `sin(0)` → `0`, `sin(Math.PI / 2)` → `~1`.

### Tests for User Story 2

- [x] T004 [P] [US2] Write unit tests for `sin` in `tests/calculator/calculator.test.ts`

### Implementation for User Story 2

- [x] T005 [US2] Implement `sin` function in `src/calculator/calculator.ts`

**Checkpoint**: User Story 2 fully functional and tested independently.

---

## Phase 4: CLI Entry Point

- [x] T006 Implement `src/calculator/calculator-cli.ts` CLI entry point

---

## Phase 5: Polish

- [x] T007 Verify TypeScript strict-mode type-checking passes (`npm run check`)
- [x] T008 Confirm all tests pass (`node --test tests/calculator/calculator.test.ts`)
