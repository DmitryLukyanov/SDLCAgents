# Implementation Plan: Simple Calculator

**Branch**: `copilot/tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911` | **Date**: 2026-03-29 | **Spec**: [spec.md](../../copilot-tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911/spec.md)  
**Input**: Feature specification from `/specs/copilot-tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911/spec.md`

## Summary

Build a TypeScript library (`src/calculator/`) that evaluates single-operation expressions (+, -, *, /, sin in degrees) and expose it as an interactive CLI REPL. The core `calculate` function is independently importable. The REPL accepts expressions in `<num> <op> <num>` or `sin(<num>)` form, returns human-readable results (plain integers or up to 10 significant digits, trailing zeros stripped), and surfaces friendly error messages for all invalid inputs. Division by zero, overflow, NaN, and unsupported operations never crash the process. The session ends on `exit` or `quit`. No external math or runtime libraries are added; all arithmetic relies on JavaScript built-in `Math`.

## Technical Context

**Language/Version**: TypeScript 5.7 / Node.js ≥ 20 (existing project constraints)  
**Primary Dependencies**: None new — `Math.sin`, `Math.PI` for trigonometry; `node:readline` for REPL; `node:test` + `node:assert/strict` for tests (all built-in)  
**Storage**: N/A  
**Testing**: Node.js built-in test runner (`node:test`) invoked via `tsx --test` to handle TypeScript without a separate compile step  
**Target Platform**: Node.js 20+ CLI / importable ESM library  
**Project Type**: Library + CLI  
**Performance Goals**: < 1 second per computation (trivially met; pure synchronous arithmetic)  
**Constraints**: No third-party math libraries; IEEE 754 double precision (`number`); no expression chaining; no history/state; ES Modules (`"type": "module"`, NodeNext resolution)  
**Scale/Scope**: Single-user local tool; five operations; one expression at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> The project constitution is not yet customised (all fields remain template placeholders). The check below applies universally recognised software-engineering principles inferred from the placeholder examples in the template.

| Gate | Status | Notes |
|------|--------|-------|
| **Library-First** — core logic independently importable | ✅ PASS | `src/calculator/calculator.ts` exports `calculate()` as a standalone function; CLI is a thin wrapper in `src/calculator/cli.ts` |
| **CLI Interface** — text in/out via stdin/stdout | ✅ PASS | Interactive REPL reads from `stdin`, writes results and errors to `stdout`; errors also routed to `stderr` |
| **Test-First (TDD)** — tests written before implementation | ✅ PASS | Plan mandates test files authored first (red phase), then implementation |
| **Integration Testing** — contract and inter-module paths covered | ✅ PASS | REPL integration tests verify the full parse → calculate → format → print pipeline |
| **Simplicity / YAGNI** — no over-engineering | ✅ PASS | Regex parser (no AST), flat module layout, zero new dependencies |
| **No external math libraries** | ✅ PASS | `Math.sin`, `Math.PI` only; no npm packages for arithmetic |

**Post-design re-check**: All gates remain PASS after Phase 1 design (see data-model.md and contracts/).

## Project Structure

### Documentation (this feature)

```text
specs/copilot/tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entities, types, state
├── quickstart.md        # Phase 1 output — dev setup & usage
├── contracts/
│   ├── library-api.md   # TypeScript public API contract
│   └── cli-protocol.md  # REPL input/output contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
└── calculator/
    ├── types.ts           # Shared types: Operation, ParsedExpression, CalculatorResult
    ├── parser.ts          # Input parser: string → ParsedExpression | ParseError
    ├── calculator.ts      # Core logic: calculate(expr) → CalculatorResult
    ├── formatter.ts       # Number formatter: formatResult(CalculatorResult) → string
    ├── index.ts           # Library entry point (re-exports public API)
    └── cli.ts             # Interactive REPL (not exported from index.ts)

tests/
└── calculator/
    ├── unit/
    │   ├── parser.test.ts       # Unit tests for parser
    │   ├── calculator.test.ts   # Unit tests for calculator core
    │   └── formatter.test.ts    # Unit tests for formatter
    └── integration/
        └── repl.test.ts         # Integration tests for full pipeline
```

**Structure Decision**: Single-project layout (Option 1). The `calculator/` module is placed alongside existing agent modules (`scrum-agent/`, `dummy-agent/`) under `src/`, consistent with the existing project convention. Test files mirror the source tree under `tests/calculator/`. No new top-level directories are introduced.

**package.json additions**:
```json
"scripts": {
  "calculator":       "tsx src/calculator/cli.ts",
  "test:calculator":  "tsx --test tests/calculator/**/*.test.ts"
}
```

## Complexity Tracking

> No constitution violations detected. Table omitted per instructions.
