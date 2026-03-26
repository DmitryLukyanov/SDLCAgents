# Tasks: Simple Calculator (TC-5)

**Input**: `specs/TC-5/spec.md`, `specs/TC-5/plan.md`

## Phase 1: Setup

- [x] T001 Create `src/calculator/` directory
- [x] T002 Create `tests/calculator/` directory

---

## Phase 2: User Story 1 — Basic Arithmetic (Priority: P1) 🎯 MVP

**Goal**: Implement add, subtract, multiply, divide with input validation.

**Independent Test**: Run `tests/calculator/calculator.local-debug.ts` and verify arithmetic results.

### Implementation

- [x] T003 [US1] Implement `add(a, b)` in `src/calculator/calculator.ts`
- [x] T004 [US1] Implement `subtract(a, b)` in `src/calculator/calculator.ts`
- [x] T005 [US1] Implement `multiply(a, b)` in `src/calculator/calculator.ts`
- [x] T006 [US1] Implement `divide(a, b)` with division-by-zero error in `src/calculator/calculator.ts`
- [x] T007 [US1] Add finite-number input validation (guard for NaN/Infinity) in `src/calculator/calculator.ts`

**Checkpoint**: Arithmetic operations return correct results; divide-by-zero throws.

---

## Phase 3: User Story 2 — Sine Function (Priority: P2)

**Goal**: Implement `sin(x)` (radians). No other trig functions.

**Independent Test**: Call `sin(0)` → 0, `sin(Math.PI/2)` ≈ 1.

### Implementation

- [x] T008 [US2] Implement `sin(x)` in `src/calculator/calculator.ts`

**Checkpoint**: sin returns correct values for standard radian inputs.

---

## Phase 4: Tests / Debug Script

- [x] T009 Create `tests/calculator/calculator.local-debug.ts` with assertions for all functions (arithmetic + sin + error cases)

---

## Phase 5: Polish

- [x] T010 Run `npm run check` (tsc --noEmit) to confirm typecheck passes
