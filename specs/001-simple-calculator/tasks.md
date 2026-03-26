---
description: "Task list for Simple Calculator (TC-5)"
---

# Tasks: Simple Calculator (TC-5)

**Input**: Design documents from `/specs/001-simple-calculator/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/cli-contract.md ✅ quickstart.md ✅

**Tests**: Included — the implementation plan explicitly mandates TDD (write tests first, ensure RED before implementing), and SC-004 requires all five operations to be independently verifiable through automated tests.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and validated independently before moving to the next priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the two source files and two test files as empty skeletons so editors, `tsc --noEmit`, and the test runner can resolve imports from the first commit. Add the npm test convenience script so the test command is stable for the entire feature branch.

- [X] T001 Create empty skeleton files `src/calculator/calculator.ts` and `src/calculator/cli.ts` (one-line `export {}` each) to satisfy module resolution
- [X] T002 Create empty skeleton files `tests/calculator/calculator.test.ts` and `tests/calculator/cli.test.ts` (one-line comments) to satisfy glob expansion
- [X] T003 Add `"test:calculator": "node --import tsx/esm --test tests/calculator/**/*.test.ts"` script to `package.json`

**Checkpoint**: `npm run test:calculator` exits 0 (no tests collected yet); `npx tsc --noEmit` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared TypeScript types that every subsequent task depends on. No logic yet — just the type contracts. Nothing in Phase 3+ can be written correctly without these types agreed and exported.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T004 Define and export `Operation`, `CalcInput`, and `CalcResult` types, plus empty stub signatures for `parseArgs()` and `calculate()`, in `src/calculator/calculator.ts`

  ```typescript
  // Exact types from data-model.md — implementations filled in per story
  export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide';
  export type UnaryOperation  = 'sin';
  export type Operation       = BinaryOperation | UnaryOperation;

  export type CalcResult =
    | { ok: true;  value: number }
    | { ok: false; error: string };

  export function parseArgs(argv: string[]): CalcResult { /* stub */ }
  export function calculate(op: Operation, operands: number[]): CalcResult { /* stub */ }
  ```

**Checkpoint**: `npx tsc --noEmit` still passes with the stubs in place; types are importable from test files.

---

## Phase 3: User Story 1 — Basic Arithmetic (Priority: P1) 🎯 MVP

**Goal**: A user can invoke `calc add|subtract|multiply|divide <a> <b>` and receive the correct numeric result on stdout with exit code 0. This is the sole MVP deliverable.

**Independent Test**:
```bash
npx tsx src/calculator/cli.ts add 3 5       # stdout: 8,   exit 0
npx tsx src/calculator/cli.ts subtract 10 3 # stdout: 7,   exit 0
npx tsx src/calculator/cli.ts multiply 2.5 4 # stdout: 10, exit 0
npx tsx src/calculator/cli.ts divide 10 4   # stdout: 2.5, exit 0
```

### Tests for User Story 1 ⚠️ Write FIRST — must be RED before any implementation

- [X] T005 [P] [US1] Write unit tests for all four arithmetic happy paths — integer, decimal, and negative operands — for `parseArgs()` and `calculate()` in `tests/calculator/calculator.test.ts`

  Minimum cases per the plan's test strategy:
  - `add`: integer sum, decimal sum, negative operands
  - `subtract`: positive difference, result-is-zero, negative result
  - `multiply`: integer product, decimal product, multiply-by-zero
  - `divide`: exact quotient, decimal quotient

- [X] T006 [P] [US1] Write CLI subprocess integration tests for arithmetic operations in `tests/calculator/cli.test.ts`

  Spawn `node --import tsx/esm src/calculator/cli.ts` as a child process; assert stdout value, empty stderr, and exit code 0 for each of the four arithmetic operations. Cover at least one integer and one decimal case per operation.

### Implementation for User Story 1

- [X] T007 [US1] Implement `parseArgs()` for binary operations in `src/calculator/calculator.ts`

  Handle only the happy path for this task: parse `argv[0]` as a `BinaryOperation` (`add|subtract|multiply|divide`) and `argv[1]`, `argv[2]` as two finite numbers. Return `{ ok: true, value: NaN }` placeholder (actual computation in T008). Error paths (wrong count, non-numeric, division-by-zero) are deferred to Phase 5.

- [X] T008 [US1] Implement `calculate()` for `add`, `subtract`, `multiply`, `divide` in `src/calculator/calculator.ts`

  Pure arithmetic using native `+`, `-`, `*`, `/` operators on `number`. Return `{ ok: true, value: result }`. Division-by-zero guard deferred to Phase 5 — for now return `Infinity` (JavaScript native behaviour) so arithmetic tests pass.

- [X] T009 [US1] Implement the `cli.ts` entry-point in `src/calculator/cli.ts`

  Read `process.argv.slice(2)`, call `parseArgs()`, then branch:
  - `ok: true` → `console.log(result.value)`, `process.exit(0)`
  - `ok: false` → `console.error('Error: ' + result.error)`, `process.exit(1)`

  This thin adapter is written once; no changes to `cli.ts` are needed in later phases.

**Checkpoint**: `npm run test:calculator` — all US1 unit tests and CLI integration tests pass (RED → GREEN). Manual smoke-test matches quickstart.md arithmetic examples.

---

## Phase 4: User Story 2 — Sine Function (Priority: P2)

**Goal**: A user can invoke `calc sin <value>` with a value in radians and receive the correct sine result on stdout with exit code 0.

**Independent Test**:
```bash
npx tsx src/calculator/cli.ts sin 0                    # stdout: 0,          exit 0
npx tsx src/calculator/cli.ts sin 1.5707963267948966   # stdout: 1,          exit 0
npx tsx src/calculator/cli.ts sin -1.5707963267948966  # stdout: -1,         exit 0
```

### Tests for User Story 2 ⚠️ Write FIRST — must be RED before any implementation

- [X] T010 [P] [US2] Write unit tests for the `sin` operation in `tests/calculator/calculator.test.ts`

  Minimum cases per the plan's test strategy:
  - `sin(0) === 0`
  - `sin(π/2) ≈ 1` (within 1e-10 tolerance)
  - `sin(-π/2) ≈ -1` (negative input, signed result)

- [X] T011 [P] [US2] Write CLI subprocess integration tests for `calc sin` in `tests/calculator/cli.test.ts`

  Spawn `cli.ts` with `sin 0`, `sin 1.5707963267948966`; assert stdout matches expected value (with numeric tolerance where applicable), empty stderr, exit code 0.

### Implementation for User Story 2

- [X] T012 [US2] Extend `parseArgs()` to recognise `sin` as a `UnaryOperation` in `src/calculator/calculator.ts`

  Detect `argv[0] === 'sin'`, parse `argv[1]` as a single finite number. Route to `calculate('sin', [operand])`. Wrong-operand-count guard (`sin 1 2` or `sin` alone) deferred to Phase 5.

- [X] T013 [US2] Add `sin` case to `calculate()` in `src/calculator/calculator.ts`

  Return `{ ok: true, value: Math.sin(operands[0]) }`. Delegates entirely to the platform `Math.sin()` — no custom implementation.

**Checkpoint**: `npm run test:calculator` — all US1 + US2 tests pass. Manual smoke-test matches quickstart.md sine examples.

---

## Phase 5: User Story 3 — Error Handling for Invalid Inputs (Priority: P3)

**Goal**: Every defined invalid input (no args, unsupported operation, wrong operand count, non-numeric input, division by zero) produces a clear, descriptive message on stderr with exit code 1 — no crash, no silent wrong result.

**Independent Test**:
```bash
npx tsx src/calculator/cli.ts                        # stderr: Error: Usage: calc <operation> [operands...],             exit 1
npx tsx src/calculator/cli.ts cos 1                  # stderr: Error: Unsupported operation: "cos". Supported: …,       exit 1
npx tsx src/calculator/cli.ts add 3                  # stderr: Error: "add" requires 2 numeric operands,                exit 1
npx tsx src/calculator/cli.ts sin 1 2                # stderr: Error: "sin" requires 1 numeric operand,                 exit 1
npx tsx src/calculator/cli.ts add abc 3              # stderr: Error: Invalid input: "abc" is not a number,             exit 1
npx tsx src/calculator/cli.ts divide 5 0             # stderr: Error: Division by zero,                                 exit 1
```

### Tests for User Story 3 ⚠️ Write FIRST — must be RED before any implementation

- [X] T014 [P] [US3] Write unit tests for all `parseArgs()` error cases in `tests/calculator/calculator.test.ts`

  Cover every row in the error-message table from `plan.md` and `contracts/cli-contract.md`:
  no args, unknown op (`cos`, `tan`, `cot`, `foo`), wrong count for binary (1 or 3 operands), wrong count for unary (0 or 2 operands), non-numeric string, empty string operand. Assert the exact error message strings defined in the contract.

- [X] T015 [P] [US3] Write CLI subprocess integration tests for all error paths in `tests/calculator/cli.test.ts`

  For each error trigger: spawn `cli.ts` with the bad input, assert stdout is empty, assert stderr equals the exact `Error: <message>` string from `contracts/cli-contract.md`, assert exit code 1.

### Implementation for User Story 3

- [X] T016 [US3] Implement no-arguments guard in `parseArgs()` in `src/calculator/calculator.ts`

  If `argv.length === 0` return `{ ok: false, error: 'Usage: calc <operation> [operands...]' }`.

- [X] T017 [US3] Implement unsupported-operation rejection in `parseArgs()` in `src/calculator/calculator.ts`

  If `argv[0]` is not in `['add', 'subtract', 'multiply', 'divide', 'sin']` return:
  `{ ok: false, error: 'Unsupported operation: "<op>". Supported: add, subtract, multiply, divide, sin' }`.
  This explicitly covers `cos`, `tan`, `cot`, and any unknown string (FR-004).

- [X] T018 [US3] Implement wrong-operand-count guards in `parseArgs()` in `src/calculator/calculator.ts`

  - Binary ops (`add|subtract|multiply|divide`) with `argv.length - 1 ≠ 2` → `{ ok: false, error: '"<op>" requires 2 numeric operands' }`
  - Unary op (`sin`) with `argv.length - 1 ≠ 1` → `{ ok: false, error: '"sin" requires 1 numeric operand' }`

- [X] T019 [US3] Implement non-numeric operand validation in `parseArgs()` in `src/calculator/calculator.ts`

  For each operand string `s`: if `Number(s)` returns `NaN` (use `Number.isNaN(Number(s))`), return `{ ok: false, error: 'Invalid input: "<s>" is not a number' }`. Check operands in order; return on the first failing operand.

- [X] T020 [US3] Implement division-by-zero guard in `calculate()` in `src/calculator/calculator.ts`

  Before performing `divide`, check `operands[1] === 0`; if so return `{ ok: false, error: 'Division by zero' }`. This replaces the `Infinity` placeholder introduced in T008.

**Checkpoint**: `npm run test:calculator` — 100% of all US1 + US2 + US3 tests pass. Every error message matches the exact strings in `contracts/cli-contract.md`. No test is skipped or pending.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Convenience alias, final smoke-test against the full quickstart, and TypeScript strict-mode confirmation.

- [X] T021 [P] Add `"calc": "tsx src/calculator/cli.ts"` convenience script to `package.json` so developers can run `npm run calc -- add 3 5`
- [X] T022 Run every command listed in `specs/001-simple-calculator/quickstart.md` and confirm stdout, stderr, and exit codes match the documented expected outputs; fix any discrepancy before marking done
- [X] T023 Run `npx tsc --noEmit` and confirm zero type errors across `src/calculator/calculator.ts` and `src/calculator/cli.ts`

**Checkpoint**: Full test suite green, quickstart validated, TypeScript clean.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup           → No dependencies; start immediately
Phase 2: Foundational    → Depends on Phase 1 (files must exist) — BLOCKS all user stories
Phase 3: User Story 1    → Depends on Phase 2 (types must be defined)
Phase 4: User Story 2    → Depends on Phase 2; can start in parallel with Phase 3
Phase 5: User Story 3    → Depends on Phase 2; can start in parallel with Phase 3 and 4
Phase 6: Polish          → Depends on all user story phases being complete
```

### User Story Dependencies

| Story | Depends on              | Can run in parallel with |
|-------|-------------------------|--------------------------|
| US1 (P1) | Phase 2 complete     | US2, US3 (different files) |
| US2 (P2) | Phase 2 complete     | US1, US3 (different files) |
| US3 (P3) | Phase 2 complete     | US1, US2 (different files) |

> **Practical note**: US1 implements `cli.ts`, which US2 and US3 integration tests depend on. On a single-developer branch, complete US1 fully (including T009) before writing US2/US3 integration tests, or stub `cli.ts` first.

### Within Each User Story

1. Write tests → confirm they **FAIL** (RED)
2. Implement logic → confirm tests **PASS** (GREEN)
3. Commit the story as a unit before moving to the next

---

## Parallel Execution Examples

### Phase 3 (US1): Tests can be written in parallel

```bash
# Two developers, or two editor tabs at the same time:
Task T005: tests/calculator/calculator.test.ts  ← unit tests
Task T006: tests/calculator/cli.test.ts         ← integration tests
```

### Phase 4 (US2): Tests can be written in parallel

```bash
Task T010: tests/calculator/calculator.test.ts  ← unit tests (sin)
Task T011: tests/calculator/cli.test.ts         ← integration tests (sin CLI)
```

### Phase 5 (US3): Tests can be written in parallel

```bash
Task T014: tests/calculator/calculator.test.ts  ← unit tests (errors)
Task T015: tests/calculator/cli.test.ts         ← integration tests (error exits)
```

### Phase 6 (Polish): npm-script addition is independent

```bash
Task T021: package.json ← add calc script  (independent of T022, T023)
Task T022: quickstart validation            (sequential: needs all code green)
Task T023: tsc --noEmit                    (parallel with T022)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1** (Setup)
2. Complete **Phase 2** (Types)
3. Complete **Phase 3** (US1 — basic arithmetic)
4. **STOP and VALIDATE**: `npm run test:calculator` passes; smoke-test quickstart arithmetic examples
5. Demo / merge if acceptable as MVP

### Incremental Delivery

| Milestone | Phases complete | What works |
|-----------|-----------------|------------|
| MVP       | 1 + 2 + 3       | `add`, `subtract`, `multiply`, `divide` — correct results |
| Milestone 2 | + Phase 4     | + `sin` (radians) |
| Milestone 3 | + Phase 5     | + all error paths (no crash, clear messages, exit 1) |
| Final     | + Phase 6       | npm alias, quickstart validated, types clean |

### Single-Developer TDD Flow (sequential)

```
T001 → T002 → T003 → T004
  → T005 (RED) → T006 (RED) → T007 → T008 → T009 (US1 GREEN)
  → T010 (RED) → T011 (RED) → T012 → T013 (US2 GREEN)
  → T014 (RED) → T015 (RED) → T016 → T017 → T018 → T019 → T020 (US3 GREEN)
  → T021 → T022 → T023 (DONE)
```

---

## Task Summary

| Phase | Tasks | Parallelizable | Story |
|-------|-------|---------------|-------|
| Phase 1: Setup | T001–T003 | — | — |
| Phase 2: Foundational | T004 | — | — |
| Phase 3: US1 Arithmetic | T005–T009 | T005, T006 | US1 |
| Phase 4: US2 Sine | T010–T013 | T010, T011 | US2 |
| Phase 5: US3 Errors | T014–T020 | T014, T015 | US3 |
| Phase 6: Polish | T021–T023 | T021, T023 | — |
| **Total** | **23 tasks** | **6 parallel pairs** | **3 stories** |

**Source files changed**: `src/calculator/calculator.ts`, `src/calculator/cli.ts`, `tests/calculator/calculator.test.ts`, `tests/calculator/cli.test.ts`, `package.json` (scripts only)

---

## Notes

- `[P]` tasks operate on **different files** — they can be committed independently with no merge conflict risk
- Each `[Story]` label maps directly to its user story in `spec.md` for full traceability
- Error message strings are **fixed** by `contracts/cli-contract.md` — tests must use exact strings; no paraphrasing
- `cli.ts` is written **once** in T009 and never modified again; all operation-specific logic lives in `calculator.ts`
- `Infinity` as a division result (overflow edge case) is **documented behaviour**, not an error — see `data-model.md` numeric behaviour table
- Commit after each task or logical group; stop at any checkpoint to validate a story independently before continuing
