---

description: "Task list for TC-5 Simple Calculator implementation"
---

# Tasks: Simple Calculator

**Input**: Design documents from `specs/copilot/tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/library-api.md ✅ · contracts/cli-protocol.md ✅  
**Branch**: `copilot/tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911`

**Tests**: Included — plan.md mandates Test-First (TDD): test files are authored *before* implementation (red phase first).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no dependencies on sibling tasks in same batch)
- **[Story]**: Which user story this task belongs to (US1 / US2 / US3)
- Setup and Foundational phases carry no story label

---

## Phase 1: Setup

**Purpose**: Wire the calculator module into the existing project — no source files yet.

- [X] T001 Add `"calculator"` and `"test:calculator"` npm scripts to `package.json`
- [X] T002 [P] Create empty directories `src/calculator/` and `tests/calculator/unit/` and `tests/calculator/integration/` (add `.gitkeep` files so the tree is committed)

**Checkpoint**: `npm run calculator` and `npm run test:calculator` resolve their entry-point paths (even before source files exist).

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Define all shared TypeScript types and enums. Every subsequent source file and test imports from this single module — no story can begin until it exists.

**⚠️ CRITICAL**: All user story work is blocked until T003 is complete.

- [X] T003 Create `src/calculator/types.ts` — declare `Operation` enum (`+`, `-`, `*`, `/`, `sin`); `BinaryExpression`, `UnaryExpression`, `ParsedExpression` union; `ParseError`, `ParseResult` union; `SuccessResult`, `ErrorResult`, `CalculatorResult` union (all exactly as specified in `contracts/library-api.md`)

**Checkpoint**: `npm run check` passes with the types file in place and no implementation files yet.

---

## Phase 3: User Story 1 — Perform Basic Arithmetic (Priority: P1) 🎯 MVP

**Goal**: A user can add, subtract, multiply, and divide two numbers via the REPL and get a correctly formatted result; division by zero returns a friendly error and the session continues.

**Independent Test**: Run the REPL (`npm run calculator`) and enter `5 + 3` → `8`, `10 - 4` → `6`, `6 * 7` → `42`, `15 / 3` → `5`, `7 / 0` → `Division by zero is not allowed.`; session stays alive after each.

### Tests for User Story 1 — Write FIRST, Verify They FAIL ⚠️

- [X] T004 [P] [US1] Write parser unit tests for binary expressions (happy paths: addition, subtraction, multiplication, division; integers and decimals; negative operands) in `tests/calculator/unit/parser.test.ts`
- [X] T005 [P] [US1] Write calculator unit tests for all four binary operations and division-by-zero error result in `tests/calculator/unit/calculator.test.ts`
- [X] T006 [P] [US1] Write formatter unit tests for: integer result (`8`), decimal with trailing zeros stripped (`0.5`), 10-significant-digit truncation (`0.3333333333`), and `Infinity`/`NaN` → `"Result is out of numeric range."` in `tests/calculator/unit/formatter.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Implement `src/calculator/parser.ts` — `parse(input: string): ParseResult`: trim input; match binary regex `/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/`; return `BinaryExpression` on match; return `ParseError` with exact catalogue messages for blank input, unsupported-operator pattern, incomplete-binary pattern, and unrecognised pattern (see `data-model.md` error catalogue)
- [X] T008 [US1] Implement `src/calculator/calculator.ts` — `evaluate(expr: ParsedExpression): CalculatorResult` for binary ops; add `calculate(expression: string): CalculatorResult` facade that calls `parse()` then `evaluate()`; guard division by zero (`right === 0` → `ErrorResult`); guard post-compute `!isFinite(value) || isNaN(value)` → `ErrorResult`
- [X] T009 [US1] Implement `src/calculator/formatter.ts` — `formatNumber(value: number): string` using `parseFloat(value.toPrecision(10)).toString()`; return `"Result is out of numeric range."` for `Infinity`, `-Infinity`, or `NaN`
- [X] T010 [US1] Implement `src/calculator/index.ts` — re-export `calculate`, `formatNumber`, `Operation`, `CalculatorResult`, `SuccessResult`, `ErrorResult`, `ParsedExpression`, `BinaryExpression`, `UnaryExpression`, `ParseError`, `ParseResult` from their respective source files
- [X] T011 [US1] Implement `src/calculator/cli.ts` — interactive REPL using `node:readline`; print banner `Calculator REPL — type "exit" to quit`; loop: print `> ` prompt, read line, trim, check `exit`/`quit` (case-insensitive) → print `Goodbye.` and `process.exit(0)`; otherwise call `calculate()` and print result string; handle `close` event (EOF) → exit 0
- [X] T012 [US1] Write integration test covering the full parse → evaluate → format pipeline for all four basic operations and division-by-zero in `tests/calculator/integration/repl.test.ts` (import `calculate` and `formatNumber` from `src/calculator/index.ts`; do not spin up readline)

**Checkpoint**: `npm run test:calculator` — all Phase 3 tests pass. `npm run calculator` accepts `5 + 3` → `8` and `7 / 0` → error message, then loops.

---

## Phase 4: User Story 2 — Compute Sine of an Angle (Priority: P2)

**Goal**: A user can type `sin(30)` and receive `0.5`; angles are interpreted as degrees; `sin(90)` → `1`, `sin(-90)` → `-1`, `sin(0)` → `0`.

**Independent Test**: Run `npm run test:calculator` after this phase — the sin-specific tests pass without breaking any Phase 3 tests. Run the REPL and enter `sin(30)` → `0.5`.

### Tests for User Story 2 — Write FIRST, Verify They FAIL ⚠️

- [X] T013 [P] [US2] Extend parser unit tests: add sin() parsing cases (`sin(0)`, `sin(30)`, `sin(-90)`, `sin( 30 )` with inner whitespace) and confirm `sin` without parentheses returns a `ParseError` in `tests/calculator/unit/parser.test.ts`
- [X] T014 [P] [US2] Extend calculator unit tests: add `sin(0) → 0`, `sin(30) → ~0.5`, `sin(90) → 1`, `sin(-90) → -1`; confirm formatted output strips trailing zeros in `tests/calculator/unit/calculator.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Extend `src/calculator/parser.ts` — add unary sin regex `/^sin\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)$/i`; check it before the binary pattern; return `UnaryExpression { kind: 'unary', operator: Operation.Sin, operand: degrees }`; a bare `sin` or `sin 30` (no parens) must still fall through to a `ParseError`
- [X] T016 [US2] Extend `src/calculator/calculator.ts` — add `sinDegrees(degrees: number): number` helper (`degrees * Math.PI / 180` passed to `Math.sin`); add `UnaryExpression` branch in `evaluate()` that calls `sinDegrees` and returns `SuccessResult`
- [X] T017 [US2] Extend integration test with sin() scenarios (`sin(0)`, `sin(30)`, `sin(90)`, `sin(-90)`) in `tests/calculator/integration/repl.test.ts`

**Checkpoint**: `npm run test:calculator` — all Phase 3 and Phase 4 tests pass. `sin(30)` → `0.5` in the live REPL.

---

## Phase 5: User Story 3 — Handle Invalid Inputs Gracefully (Priority: P3)

**Goal**: Every malformed, blank, unsupported, or overflow-producing input results in a specific descriptive message; the REPL never crashes and always prompts again.

**Independent Test**: Submit empty input → `"Please enter a valid expression."`, `cos(30)` → `"Unsupported operation. Supported: +, -, *, /, sin."`, `5 +` → `"Incomplete expression. Expected: <number> <+|-|*|/> <number>."`, `abc` → `"Invalid expression. Try: 5 + 3 or sin(30)."`. Session continues after each.

### Tests for User Story 3 — Write FIRST, Verify They FAIL (or surface gaps) ⚠️

- [X] T018 [P] [US3] Extend parser unit tests for all four `ParseError` message strings: blank/whitespace-only, unsupported function (`cos`, `%`, `^`), incomplete binary (`5 +`, `* 3`), and unrecognised pattern (`abc`, `1 + 2 + 3`) in `tests/calculator/unit/parser.test.ts`
- [X] T019 [P] [US3] Extend calculator unit tests for overflow/NaN paths: very large number multiplication producing `Infinity`, `0 / 0`-style NaN — confirm `ErrorResult` with `"Result is out of numeric range."` in `tests/calculator/unit/calculator.test.ts`
- [X] T020 [P] [US3] Extend formatter unit tests for `Infinity`, `-Infinity`, and `NaN` inputs — confirm return value is `"Result is out of numeric range."` in `tests/calculator/unit/formatter.test.ts`

### Implementation / Verification for User Story 3

- [X] T021 [US3] Audit `src/calculator/parser.ts` — verify all four `ParseError` message strings match the catalogue verbatim (punctuation, casing, phrasing) as specified in `data-model.md`; correct any discrepancies
- [X] T022 [US3] Audit `src/calculator/calculator.ts` — confirm the post-compute overflow guard (`!isFinite(value) || isNaN(value)`) runs after every binary and unary evaluation branch; add guard if missing
- [X] T023 [US3] Audit `src/calculator/cli.ts` — confirm REPL loop does not `throw` on any input; verify `close` (EOF) and `SIGINT` (Ctrl-C) both exit with code 0 without printing a stack trace
- [X] T024 [US3] Extend integration test with all error scenarios: blank input, `cos(30)`, `5 +`, unrecognised pattern, and division-by-zero — assert exact error message strings in `tests/calculator/integration/repl.test.ts`

**Checkpoint**: `npm run test:calculator` — all Phase 3, 4, and 5 tests pass. Zero crashes on any tested input.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Full suite validation, type safety, and quickstart verification.

- [X] T025 [P] Run `npm run test:calculator` — confirm all tests pass and zero failures are reported; resolve any remaining test failures
- [X] T026 [P] Run `npm run check` (`tsc --noEmit`) — resolve any TypeScript type errors introduced across `src/calculator/` and `tests/calculator/`
- [X] T027 Validate the live REPL against `contracts/cli-protocol.md` end-to-end: banner text matches exactly, `> ` prompt appears, each expression from the sample session produces the correct output line, `exit` prints `Goodbye.` and exits cleanly

---

## Dependency Graph

```
T001 ──┐
T002 ──┤
       └──► T003 (types.ts)
                │
                ├──► T004, T005, T006 (unit tests — write first, must FAIL) ──┐
                │                                                              │
                ├──► T007 (parser.ts)  ─────────────────────────────────────►─┤
                ├──► T008 (calculator.ts)  ──────────────────────────────────►─┤
                ├──► T009 (formatter.ts)  ───────────────────────────────────►─┤
                ├──► T010 (index.ts)  ────────────────────────────────────────►┤
                ├──► T011 (cli.ts)  ──────────────────────────────────────────►┤
                └──► T012 (integration — US1)  ──────────────────────────────►─┤
                                                                               │
                             ◄── Phase 3 checkpoint ─────────────────────────►┘
                                          │
                     ┌────────────────────┼──────────────────────┐
                     ▼                    ▼                       ▼
              T013, T014              T018, T019, T020       (can parallelise
              (write first)           (write first)           US2 & US3 work)
                     │                    │
              T015, T016              T021, T022, T023
              T017 (integration)      T024 (integration)
                     │                    │
                     └────────┬───────────┘
                              ▼
                      T025, T026, T027
```

### User Story Completion Order

| Story | Depends On | Can Start After |
|-------|-----------|----------------|
| US1 — Basic Arithmetic | Phase 2 only | T003 complete |
| US2 — Sine | Phase 2 + US1 types + parser/calculator structure | Phase 3 checkpoint |
| US3 — Error Handling | Phase 2 + US1 parser + US2 parser | Phase 4 checkpoint (or Phase 3 if US2 is skipped for MVP) |

---

## Parallel Execution Examples

### Phase 3 — Launch all three test-authoring tasks together (TDD red phase)

```
Task: T004 — parser binary tests       tests/calculator/unit/parser.test.ts
Task: T005 — calculator binary tests   tests/calculator/unit/calculator.test.ts
Task: T006 — formatter tests           tests/calculator/unit/formatter.test.ts
```

### Phase 4 — Tests in parallel, then implementation in sequence

```
Task: T013 — parser sin tests          tests/calculator/unit/parser.test.ts
Task: T014 — calculator sin tests      tests/calculator/unit/calculator.test.ts
  (both complete) → T015 → T016 → T017
```

### Phase 5 — All three error-path test tasks in parallel

```
Task: T018 — parser error tests        tests/calculator/unit/parser.test.ts
Task: T019 — calculator overflow tests tests/calculator/unit/calculator.test.ts
Task: T020 — formatter edge tests      tests/calculator/unit/formatter.test.ts
```

### Final Phase — Type-check and test run in parallel

```
Task: T025 — npm run test:calculator
Task: T026 — npm run check
  (both complete) → T027
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1**: Setup (T001–T002)
2. Complete **Phase 2**: Foundational (T003)
3. Complete **Phase 3**: User Story 1 (T004–T012)
4. **STOP and VALIDATE**: `npm run test:calculator` passes; live REPL handles `5 + 3`, `7 / 0`
5. **Ship MVP** — the library (`calculate`, `formatNumber`) is importable; CLI is usable

### Incremental Delivery

1. Setup + Foundational → types module ready
2. **+US1** → basic arithmetic works → demo-able, importable library
3. **+US2** → sine works → extended mathematical utility
4. **+US3** → all edge cases covered → production-hardened

### Parallel Team Strategy

After Phase 2 (T003) is merged:
- **Developer A**: US1 (T004–T012)
- **Developer B**: US2 (T013–T017) — can start once T007/T008 are merged from A
- **Developer C**: US3 (T018–T024) — can start once T007 is merged from A

All three stories integrate through `src/calculator/index.ts` — no circular dependencies.

---

## Notes

- **[P]** tasks touch different files and have no dependency on sibling [P] tasks in the same batch.
- Every test task must be committed and *failing* before the corresponding implementation task begins (TDD red–green cycle).
- Commit after each task or logical group (e.g., after T004–T006 with failing tests; after T007–T011 once tests go green).
- The `src/calculator/types.ts` file (T003) is the only shared contract; all other files import from it, never circularly.
- `cli.ts` is intentionally excluded from `index.ts` re-exports — library consumers never pull in `node:readline`.
- Error message strings are part of the public contract (CLI protocol and library API); do not alter them without updating both contract documents.
