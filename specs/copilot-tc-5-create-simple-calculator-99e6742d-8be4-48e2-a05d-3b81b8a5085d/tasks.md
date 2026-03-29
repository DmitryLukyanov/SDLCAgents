# Tasks: Simple Calculator CLI REPL

**Input**: Design documents from `specs/copilot-tc-5-create-simple-calculator-99e6742d-8be4-48e2-a05d-3b81b8a5085d/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · data-model.md ✅ · contracts/cli-interface.md ✅ · research.md ✅ · quickstart.md ✅

**Tech Stack**: TypeScript 5.7 · Node.js ≥ 20 · `node:readline` · `node:test` + `node:assert` · zero runtime dependencies
**Tests**: Included (explicitly requested — lexer, parser, and REPL)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no unresolved dependencies)
- **[Story]**: Which user story owns this task (US1 = Basic Arithmetic, US2 = Sine Function)
- All paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Create the directory skeleton and wire up `package.json` scripts so every subsequent task has a known home and can be run with a single command.

- [X] T001 Create empty `src/calculator/` and `tests/calculator/` directories with a `.gitkeep` placeholder each (or any initial file) so the tree matches the layout in `plan.md`
- [X] T002 Add `"calculator": "tsx src/calculator/index.ts"` and `"test:calculator": "node --test tests/calculator/"` scripts to `package.json` alongside the existing scripts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks that **both** user stories depend on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: The lexer (`lexer.ts`) is imported by the parser; the formatter (`formatter.ts`) is imported by the REPL. Both must exist before any story implementation or tests are authored.

- [X] T003 Implement `TokenType` enum, `Token` type, and `Lexer` class in `src/calculator/lexer.ts` — the class must expose a `tokenise(): Token[]` method and handle: whitespace (skip), `NUMBER` (`/\d+(\.\d*)?|\.\d+/`), `IDENT` (`/[a-zA-Z_][a-zA-Z0-9_]*/`), single-char operators `+` `-` `*` `/` `(` `)`, and `EOF`; unknown characters throw `Error: Unexpected character '<ch>'`
- [X] T004 [P] Implement pure `format(n: number): string` function in `src/calculator/formatter.ts` — rules: (1) if `!isFinite(n)` return `String(n)`; (2) otherwise return `parseFloat(n.toPrecision(10)).toString()` — so `42` displays as `"42"`, `1/3` as `"0.3333333333"`, `sin(180)` raw value as `"1.224646799e-16"`
- [X] T005 [P] Write all `Lexer` unit tests in `tests/calculator/lexer.test.ts` using `node:test` and `node:assert/strict` — cover: integer literals, decimal literals (`.5`, `3.14`), all six operator/paren characters, the `sin` IDENT token, whitespace skipping between tokens, mixed expression tokenisation (`-5 + 3`, `sin(90)`, `(2+3)*4`), and the unknown-character error throw

**Checkpoint**: `node --test tests/calculator/lexer.test.ts` passes; formatter is importable.

---

## Phase 3: User Story 1 — Perform Basic Arithmetic (Priority: P1) 🎯 MVP

**Goal**: A complete, runnable REPL that handles `+`, `-`, `*`, `/` with correct operator precedence, parentheses, unary minus, 10-significant-digit formatting, empty-line silent re-prompt, and clean exit on `exit`/`quit`/Ctrl+C.

**Independent Test**: Launch `npm run calculator`; verify each acceptance scenario from spec.md §User Story 1 (scenarios 1–11 inclusive) produces the expected output.

### Tests for User Story 1

> **Write these tests FIRST — they must FAIL before T008/T009 exist**

- [X] T006 [P] [US1] Write parser/evaluator unit tests in `tests/calculator/parser.test.ts` using `node:test` — cover every arithmetic acceptance scenario from spec.md US1: `10 + 5` → `15`, `8 - 3` → `5`, `6 * 7` → `42`, `20 / 4` → `5`, `5 / 0` throws `Division by zero`, `2 + 3 * 4` → `14` (precedence), `(2 + 3) * 4` → `20` (parens), `-5 + 3` → `-2` (unary minus), `3 * -2` → `-6` (unary in sub-expression), `1 / 3` → `"0.3333333333"` (formatter), and the error cases: unknown function, missing `)`, trailing garbage
- [X] T007 [P] [US1] Write REPL integration tests in `tests/calculator/repl.test.ts` using `node:test` — simulate stdin streams to cover: empty line produces no output and re-prompts silently, `exit` command exits with code 0, `quit` command exits with code 0, a parse error prints `Error: <message>` then re-prompts without crashing, SIGINT exits with code 0

### Implementation for User Story 1

- [X] T008 [US1] Implement `evaluate(source: string): number` and the `Parser` class in `src/calculator/parser.ts` — implement four grammar productions exactly as specified in `data-model.md`: `expression()` for `+`/`-`, `term()` for `*`/`/` (throw `Error: Division by zero` when divisor is 0), `unary()` for unary `-`, `primary()` for `NUMBER` literals and `'(' expression ')'` — the `IDENT` / `sin` branch is **not** implemented yet (left for T012); unknown identifiers in `primary()` must throw `Error: Unknown function '<name>'`; after `expression()` completes assert next token is `EOF` else throw `Error: Unexpected token '<tok>'`; import `Lexer` from `./lexer.js` and `Token`/`TokenType` types with `import type`
- [X] T009 [US1] Implement `startRepl(): void` in `src/calculator/repl.ts` using `node:readline` — create `readline.Interface` on `process.stdin`/`process.stdout`; register `process.on('SIGINT', ...)` to close the interface and call `process.exit(0)`; in the recursive `prompt()` inner function: call `rl.question('> ', handler)`; in `handler`: (1) trim input, (2) if empty string re-call `prompt()` silently, (3) if `trimmed.toLowerCase()` is `'exit'` or `'quit'` call `rl.close()` then `process.exit(0)`, (4) otherwise call `evaluate(trimmed)` inside try/catch — on success call `format(result)` and write to stdout followed by newline then re-call `prompt()`, on error write `Error: <message>` to stdout then re-call `prompt()`; import `evaluate` from `./parser.js` and `format` from `./formatter.js`
- [X] T010 [US1] Implement the entry point in `src/calculator/index.ts` — single import of `startRepl` from `./repl.js` and a single call `startRepl()`; file must be runnable via `tsx src/calculator/index.ts` and via `npm run calculator`

**Checkpoint**: `npm run calculator` launches the REPL; all US1 acceptance scenarios pass manually; `node --test tests/calculator/` passes for lexer and parser tests.

---

## Phase 4: User Story 2 — Compute Sine of a Number (Priority: P2)

**Goal**: Extend the parser to recognise `sin(<expression>)` as a valid `primary`, converting the argument from degrees to radians before calling `Math.sin()`. All existing US1 behaviour remains unchanged.

**Independent Test**: At the running REPL, verify: `sin(0)` → `0`, `sin(90)` → `1`, `sin(180)` prints a value within `0.0001` of `0` (floating-point artefact acceptable), `10 + sin(30) * 2` → `11`, `sin(abc)` → `Error: Unexpected character 'a'`, `cos(45)` → `Error: Unknown function 'cos'`.

### Tests for User Story 2

> **Write these tests FIRST — extend the existing test file; the sin-specific cases must FAIL before T012**

- [X] T011 [P] [US2] Extend `tests/calculator/parser.test.ts` with a dedicated `sin` describe block — add test cases: `sin(0)` → `0`, `sin(90)` → `1`, `sin(30)` → `0.5`, `sin(180)` within `±0.0001` of `0`, `10 + sin(30) * 2` → `11` (embedded in larger expression), `cos(45)` throws `Error: Unknown function 'cos'`

### Implementation for User Story 2

- [X] T012 [US2] Add `sin` handling to the `primary()` method in `src/calculator/parser.ts` — when the current token is `IDENT` and its `value` is `'sin'`: consume the IDENT token, assert next token is `LPAREN` (else throw `Error: Expected '('`), consume `LPAREN`, call `this.expression()` to evaluate the argument, assert next token is `RPAREN` (else throw `Error: Expected ')'`), consume `RPAREN`, return `Math.sin(arg * Math.PI / 180)`; if the IDENT value is anything other than `'sin'` throw `Error: Unknown function '<name>'`

**Checkpoint**: `node --test tests/calculator/` passes all tests including the new sin block; `npm run calculator` evaluates all US2 acceptance scenarios correctly.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Type safety verification, full test pass, and manual acceptance validation against the complete spec.

- [X] T013 [P] Run `npm run check` (`tsc --noEmit`) and fix any TypeScript errors — ensure `strict: true`, `verbatimModuleSyntax`, and `NodeNext` module resolution are all satisfied; all `.js` extension imports are present in TypeScript source files (e.g., `import { Lexer } from './lexer.js'`); `import type` is used for type-only imports
- [X] T014 [P] Run `node --test tests/calculator/` and verify all tests pass — fix any failing tests discovered; ensure the test output matches the expected suite from `quickstart.md` (lexer, parser/evaluator, REPL describe blocks all green)
- [X] T015 Perform a manual smoke test against every acceptance scenario listed in `spec.md` §User Scenarios & Testing (US1 scenarios 1–11 and US2 scenarios 1–5) and every edge case in §Edge Cases — run via `npm run calculator`; document any deviation found and fix it

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational — BLOCKS all user stories)
        ├─► Phase 3 (US1 — Basic Arithmetic) — MVP complete here
        │     └─► Phase 4 (US2 — Sine Function)
        │           └─► Phase 5 (Polish)
        └─► [Phase 4 is also implicitly gated on Phase 3's parser existing]
```

### User Story Dependencies

| Story | Gate | Depends on other stories? |
|---|---|---|
| US1 (P1) | Phase 2 complete | No — standalone |
| US2 (P2) | Phase 3 complete (parser.ts must exist to extend) | Extends US1 parser — NOT independently runnable without US1 base |

### Within Each User Story

1. Tests written first (FAIL) → implementation makes them pass
2. Tests (`T006`, `T007`) before implementation (`T008`, `T009`, `T010`) in US1
3. Test extension (`T011`) before sin implementation (`T012`) in US2
4. In US1: `T008` (parser) before `T009` (REPL, which imports parser); `T009` before `T010` (entry point, which imports REPL)

### Parallel Opportunities

```
Phase 2:  T004 (formatter.ts) ║ T005 (lexer.test.ts)   — different files, no mutual deps
Phase 3:  T006 (parser.test.ts) ║ T007 (repl.test.ts)  — different files, no mutual deps
Phase 5:  T013 (tsc check)    ║ T014 (test run)         — independent verification steps
```

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These two tasks can run at the same time:
Task T004: "Implement format() in src/calculator/formatter.ts"
Task T005: "Write Lexer unit tests in tests/calculator/lexer.test.ts"

# T003 must complete first — it is the prerequisite for both T004 and T005 knowledge
```

## Parallel Example: User Story 1 (Test-writing phase)

```bash
# These two tasks can run at the same time once Phase 2 is complete:
Task T006: "Write parser/evaluator tests in tests/calculator/parser.test.ts"
Task T007: "Write REPL integration tests in tests/calculator/repl.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1** (Setup — T001, T002)
2. Complete **Phase 2** (Foundational — T003, T004+T005 in parallel)
3. Complete **Phase 3** (US1 — T006+T007 in parallel, then T008→T009→T010)
4. **STOP and VALIDATE**: `npm run calculator` handles all basic arithmetic; `node --test tests/calculator/` is green
5. Ship / demo the working arithmetic REPL

### Incremental Delivery

1. **MVP (Phases 1–3)** → Arithmetic REPL working, all US1 scenarios passing
2. **+US2 (Phase 4)** → `sin(degrees)` layered on top; no US1 regressions
3. **+Polish (Phase 5)** → Type-check clean, full test suite green, manual smoke test signed off

### Parallel Team Strategy

With two developers:
- **Developer A** — T003, then T004 and T008 (lexer → formatter → parser)
- **Developer B** — T005, then T006, T007, T009, T010 (lexer tests → all other tests → REPL → entry point)

Both converge at Phase 5.

---

## Key File Reference

| File | Task Created | Purpose |
|---|---|---|
| `src/calculator/lexer.ts` | T003 | `Lexer` class: string → `Token[]` |
| `src/calculator/formatter.ts` | T004 | `format(n)`: number → 10-sig-digit string |
| `src/calculator/parser.ts` | T008 + T012 | `evaluate(src)`: string → number (arithmetic + sin) |
| `src/calculator/repl.ts` | T009 | `startRepl()`: readline REPL loop |
| `src/calculator/index.ts` | T010 | Entry point — calls `startRepl()` |
| `tests/calculator/lexer.test.ts` | T005 | Lexer unit tests |
| `tests/calculator/parser.test.ts` | T006 + T011 | Parser/evaluator unit tests (arithmetic + sin) |
| `tests/calculator/repl.test.ts` | T007 | REPL integration tests (stdin simulation) |
| `package.json` | T002 | `"calculator"` and `"test:calculator"` scripts |

---

## Notes

- `[P]` tasks touch **different files** and have **no dependency on an incomplete task** — safe to assign to a parallel agent or second developer
- `[Story]` label maps each task to a user story for traceability and independent validation
- All imports in TypeScript source **must use `.js` extension** (e.g., `'./lexer.js'`) — required by `NodeNext` module resolution in `tsconfig.json`
- Type-only imports **must use `import type`** — required by `verbatimModuleSyntax`
- Error output goes to **stdout** (not stderr) per the CLI contract (`contracts/cli-interface.md §11`)
- `sin` argument is **always degrees** — `Math.sin(arg * Math.PI / 180)` — never raw radians
- `format()` strips trailing zeros via `parseFloat(n.toPrecision(10)).toString()` — no external library
- Commit after each task or logical group; stop at any **Checkpoint** to validate independently
