---
description: "Task list for TC-5 Simple Calculator implementation"
---

# Tasks: Simple Calculator (TC-5)

**Input**: Design documents from `specs/TC-5/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/calculator-api.md ✅, quickstart.md ✅

**Tests**: Included — the feature specification explicitly requires tests using the Node.js built-in `node:test` runner.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story increment.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different file from other [P] tasks at the same level, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are specified in every task description

---

## Phase 1: Setup

**Purpose**: Create the directory structure needed by all subsequent phases.

- [ ] T001 Create directories `src/calculator/` and `tests/calculator/` per implementation plan

---

## Phase 2: Foundational — Calculator Library

**Purpose**: Implement the importable TypeScript library module. Both the CLI (Phase 3+) and the test suite (Phase 3+) depend on this module being in place before any story work can start.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Implement arithmetic named exports (`add`, `subtract`, `multiply`, `divide`) in `src/calculator/calculator.ts` — `divide` must throw `new Error('Division by zero is not allowed')` when the divisor is `0`; all other inputs pass through JavaScript arithmetic unchanged; use ESM `export function` syntax with `.js` import extensions (NodeNext resolution)
- [ ] T003 Implement `sin` (delegating to `Math.sin`) and `formatResult` (using `parseFloat(n.toFixed(10)).toString()` to cap at 10 decimal places and trim trailing zeros) as named exports in `src/calculator/calculator.ts`

**Checkpoint**: Library complete — `src/calculator/calculator.ts` exports six symbols: `add`, `subtract`, `multiply`, `divide`, `sin`, `formatResult`.

---

## Phase 3: User Story 1 — Basic Arithmetic via CLI (Priority: P1) 🎯 MVP

**Goal**: A user can run `npx tsx src/calculator/calculator-cli.ts 10 + 5` and receive `15` on stdout with exit code `0`. All four binary operators work. All error paths exit with code `1` and print to stderr.

**Independent Test**:
```bash
npx tsx src/calculator/calculator-cli.ts 10 + 5        # → stdout: 15
npx tsx src/calculator/calculator-cli.ts 1 / 3         # → stdout: 0.3333333333
npx tsx src/calculator/calculator-cli.ts 10 / 2        # → stdout: 5
npx tsx src/calculator/calculator-cli.ts 1 / 0         # → stderr: Error: Division by zero is not allowed, exit 1
npx tsx src/calculator/calculator-cli.ts foo + 5       # → stderr: Error: "foo" is not a valid number, exit 1
```

### Tests for User Story 1

> **Write these before or alongside T006 — they should pass as soon as the library (Phase 2) is complete.**

- [ ] T004 [P] [US1] Write `describe('add', ...)`, `describe('subtract', ...)`, `describe('multiply', ...)`, and `describe('divide', ...)` blocks (including `divide(1, 0)` throws assertion) using `node:test` and `node:assert/strict` in `tests/calculator/calculator.test.ts`
- [ ] T005 [US1] Add `describe('formatResult', ...)` block (whole-number result, trailing-zero trim, exactly 10 d.p.) to `tests/calculator/calculator.test.ts`

### Implementation for User Story 1

- [ ] T006 [P] [US1] Implement `parseArg(token: string): number` helper in `src/calculator/calculator-cli.ts` — uses `Number(token)` + `Number.isFinite` check, throws `Error` with message `"${token}" is not a valid number` for non-finite results; this handles negative numbers like `-5` transparently (FR-011) without any flag-parser logic
- [ ] T007 [US1] Implement the 3-argument binary dispatch path (`args.length === 3`, `args[1]` is one of `+`, `-`, `*`, `/`) in `src/calculator/calculator-cli.ts` — call the appropriate library function, pass result to `formatResult`, print to stdout via `console.log`
- [ ] T008 [US1] Implement all CLI error paths in `src/calculator/calculator-cli.ts`: wrong argument count → usage hint (`Usage: calc <number> <+|-|*|/> <number>\n       calc sin <number>`) to stderr + exit 1; unsupported operator → `Unsupported operator "${op}". Supported operators: +, -, *, /, sin` to stderr + exit 1; non-numeric input (re-throw from `parseArg`) → `Error: ${e.message}` to stderr + exit 1; division-by-zero (re-throw from library) → `Error: ${e.message}` to stderr + exit 1
- [ ] T009 [P] [US1] Add `"calculator": "tsx src/calculator/calculator-cli.ts"` entry to the `"scripts"` section of `package.json`

**Checkpoint**: All four arithmetic operators work end-to-end from the CLI. `npm run calculator 10 + 5` prints `15`. Unit tests for all library arithmetic functions pass.

---

## Phase 4: User Story 2 — Sine Function via CLI (Priority: P2)

**Goal**: A user can run `npx tsx src/calculator/calculator-cli.ts sin 1.5707963268` and receive `1` on stdout with exit code `0`. The CLI also rejects unsupported operators like `cos` with a clear error listing supported ones.

**Independent Test**:
```bash
npx tsx src/calculator/calculator-cli.ts sin 0              # → stdout: 0
npx tsx src/calculator/calculator-cli.ts sin 1.5707963268   # → stdout: 1
npx tsx src/calculator/calculator-cli.ts sin -1.5707963268  # → stdout: -1
npx tsx src/calculator/calculator-cli.ts 1 cos 1            # → stderr: Error: Unsupported operator "cos"..., exit 1
```

### Tests for User Story 2

- [ ] T010 [US2] Add `describe('sin', ...)` block — test cases: `sin(0)=0`, `sin(Math.PI/2)≈1`, `sin(-Math.PI/2)≈-1`, large number (e.g. `1e9`) does not crash — to `tests/calculator/calculator.test.ts`
- [ ] T011 [US2] Add `describe('CLI integration', ...)` block using `node:child_process` `spawnSync` to `tests/calculator/calculator.test.ts` — cover: binary op success (`10 + 5 → 15`), fractional output (`1 / 3 → 0.3333333333`), sin success (`sin 0 → 0`), negative left operand (`-5 + 3 → -2`, asserting FR-011 compliance), div-by-zero (stderr + exit 1), non-numeric input (stderr + exit 1), unsupported operator (stderr + exit 1), wrong argument count (usage hint + exit 1)

### Implementation for User Story 2

- [ ] T012 [US2] Add the unary `sin` dispatch path to `src/calculator/calculator-cli.ts` — detect `args[0] === 'sin'` with `args.length === 2`, call `parseArg(args[1])`, call `sin(x)` from the library, print `formatResult(result)` to stdout; wire this check before the binary-arg check so the argument-count validator routes `sin <num>` correctly

**Checkpoint**: `npx tsx src/calculator/calculator-cli.ts sin 1.5707963268` prints `1`. CLI integration tests (T011) all pass. Unsupported operator `cos` produces the correct error listing `sin` as supported.

---

## Phase 5: User Story 3 — Programmatic Library Usage (Priority: P3)

**Goal**: A developer can `import { add, subtract, multiply, divide, sin, formatResult } from './src/calculator/calculator.js'` and call all six functions in their own TypeScript code. Error handling uses standard `try/catch` on `Error` instances — no discriminated unions.

**Independent Test**: Import the module in the test file and assert all six exports are functions; assert `divide(1, 0)` throws an instance of `Error` (not returns `Infinity` or `NaN`).

### Tests for User Story 3

- [ ] T013 [US3] Add `describe('library module exports', ...)` block to `tests/calculator/calculator.test.ts` — assert all six named exports (`add`, `subtract`, `multiply`, `divide`, `sin`, `formatResult`) are of type `'function'`; assert `divide(1, 0)` throws an `Error` instance (`assert.throws(() => divide(1, 0), { instanceOf: Error, message: 'Division by zero is not allowed' })`); assert `add(2, 3)` returns `5` (smoke-test end-to-end import chain)

**Checkpoint**: T013 tests pass. All three user stories are independently testable from a single `node --import tsx/esm --test tests/calculator/calculator.test.ts` run.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript correctness verification and final test-suite validation across all stories.

- [ ] T014 Run `npm run check` (`tsc --noEmit`) and resolve any TypeScript strict-mode errors in `src/calculator/calculator.ts` and `src/calculator/calculator-cli.ts` — confirm no implicit `any`, no missing return types, all `.js` import extensions present (NodeNext resolution)
- [ ] T015 [P] Run `node --import tsx/esm --test tests/calculator/calculator.test.ts` and confirm all describe blocks pass with exit code `0` — this validates the full suite: arithmetic unit tests, formatResult, sin, CLI integration, and module export verification

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational — Library)        ← BLOCKS all user stories
             ├── Phase 3 (US1 — Basic Arithmetic CLI)    [MVP]
             │        └── Phase 4 (US2 — Sine CLI)
             │                   └── Phase 5 (US3 — Library Usage)
             │                                └── Phase 6 (Polish)
             └── (T009 npm script can run any time after Phase 1)
```

### User Story Dependencies

| Story | Depends on | Can start after |
|---|---|---|
| **US1 (P1)** | Phase 2 complete | T003 ✅ |
| **US2 (P2)** | Phase 2 + US1 CLI error paths (T008) | T008 ✅ |
| **US3 (P3)** | Phase 2 (library exists), US2 CLI integration tests written | T011 ✅ |

### Within Each User Story

- Tests (T004, T010, T013) are written to run against the library from Phase 2 — they can be written before or alongside CLI tasks
- CLI tasks within a story are sequential: arg-parsing helper → dispatcher → error paths → sin path
- Integration tests (T011) require the complete CLI (T008 + T012) to be implemented first

### Parallel Opportunities Per Story

**Phase 3 (US1)** — after T003 completes:
```
T004 [P]  →  tests/calculator/calculator.test.ts  (arithmetic unit tests)
T006 [P]  →  src/calculator/calculator-cli.ts     (parseArg + arg detection)
T009 [P]  →  package.json                         (npm script)
```
All three can run simultaneously. Then T005 (same file as T004), T007 (same file as T006), T008 (same file as T007) proceed sequentially.

**Phase 4 (US2)** — after T008 + T005 complete:
```
T010  →  tests/calculator/calculator.test.ts  (sin unit tests, sequential — same file as T005)
T012  →  src/calculator/calculator-cli.ts     (sin path, sequential — same file as T008)
```
T011 (integration tests) waits for both T010 and T012.

---

## Parallel Execution Examples

### Phase 3 Parallel Launch

```bash
# After T003 completes, launch these three tasks simultaneously:

# Agent A — test file
Task: "Write arithmetic unit tests (add, subtract, multiply, divide, div-by-zero) in tests/calculator/calculator.test.ts" (T004)

# Agent B — CLI source
Task: "Implement parseArg helper and binary argument detection in src/calculator/calculator-cli.ts" (T006)

# Agent C — config
Task: "Add calculator npm script to package.json" (T009)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1**: Create directories (T001)
2. Complete **Phase 2**: Full library with all six exports (T002–T003)
3. Complete **Phase 3**: Unit tests + binary CLI + npm script (T004–T009)
4. **STOP and VALIDATE**: `npx tsx src/calculator/calculator-cli.ts 10 + 5` → `15` ✅
5. Deliver if ready

### Incremental Delivery

1. **Phase 1 + 2** → Library ready, importable, type-checked
2. **+ Phase 3** → Binary arithmetic CLI works end-to-end → Deploy/Demo (MVP!)
3. **+ Phase 4** → `sin` command works from CLI → Deploy/Demo
4. **+ Phase 5** → Library usage verified by tests, devs can import
5. **+ Phase 6** → Full type-check + complete test run confirms nothing regressed

### Single-Developer Sequence

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
                                   → T010 → T011 → T012
                                                  → T013 → T014 → T015
```

---

## Summary

| Phase | Tasks | User Story | Parallel Available |
|---|---|---|---|
| Phase 1: Setup | T001 | — | No |
| Phase 2: Library | T002–T003 | — (foundational) | No (same file) |
| Phase 3: Basic Arithmetic CLI | T004–T009 | US1 (P1) 🎯 | T004, T006, T009 |
| Phase 4: Sine CLI | T010–T012 | US2 (P2) | No (sequential) |
| Phase 5: Library Usage | T013 | US3 (P3) | No (same file) |
| Phase 6: Polish | T014–T015 | — | T015 |
| **Total** | **15 tasks** | **3 stories** | **3 parallel slots in Phase 3** |

### Test Coverage Map

| Test task | Covers | Verify command |
|---|---|---|
| T004 | add, subtract, multiply, divide (unit) | `node --import tsx/esm --test tests/calculator/calculator.test.ts` |
| T005 | formatResult (unit) | same |
| T010 | sin (unit) | same |
| T011 | CLI binary+sin+errors+negatives (integration) | same |
| T013 | All 6 exports importable, Error contract (module) | same |

### File Map

| File | Created/modified in | Tasks |
|---|---|---|
| `src/calculator/calculator.ts` | Phase 2 | T002, T003 |
| `src/calculator/calculator-cli.ts` | Phase 3–4 | T006, T007, T008, T012 |
| `tests/calculator/calculator.test.ts` | Phase 3–5 | T004, T005, T010, T011, T013 |
| `package.json` | Phase 3 | T009 |

---

## Notes

- All imports in `.ts` files **must** use `.js` extensions (NodeNext module resolution in `tsconfig.json`)
- `verbatimModuleSyntax: true` in `tsconfig.json` — use `import type` for type-only imports
- The `*` operator must be quoted in shell (`'*'`) but the CLI itself does not need special handling — `process.argv` receives it unquoted
- `sin` function name shadows the built-in math context but not any Node.js global — safe to use as an export name
- Run tests with `node --import tsx/esm --test` (not `tsx --test`) to use the Node.js built-in runner directly
- T011 integration tests must invoke the CLI via `spawnSync('node', ['--import', 'tsx/esm', 'src/calculator/calculator-cli.ts', ...args])` so they work in CI without a global `tsx` install
