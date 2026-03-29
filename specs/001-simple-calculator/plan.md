# Implementation Plan: Simple Calculator (TC-5)

**Branch**: `001-simple-calculator` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-simple-calculator/spec.md`

## Summary

Implement a pure TypeScript library module (`src/lib/calculator.ts`) that exports five named functions: `add`, `subtract`, `multiply`, `divide`, and `sinDeg`. Each function accepts discrete numeric arguments, validates inputs, and returns a `number` rounded to 4 decimal places for non-integer results (integer results returned as whole numbers). Division by zero throws a descriptive error. The module has no runtime dependencies, no state, and no I/O. A Vitest test suite (`tests/unit/calculator.test.ts`) covers all acceptance scenarios and edge cases from the spec.

## Technical Context

**Language/Version**: TypeScript 5.7 / Node.js ≥20  
**Primary Dependencies**: None (runtime) · `vitest@4.1.2` (devDependency — new addition)  
**Storage**: N/A  
**Testing**: Vitest 4.1.2 — native ESM, TypeScript-first, zero config for this project type  
**Target Platform**: Node.js ≥20 (Linux/macOS/Windows)  
**Project Type**: Library module (importable TypeScript named exports)  
**Performance Goals**: Synchronous computation — no latency target; each call completes in <1 ms  
**Constraints**: No build step (noEmit: true); NodeNext ESM resolution (`.js` import extensions); `strict: true`  
**Scale/Scope**: Single module, 5 exported functions, ~1 test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Note**: The project constitution (`/.specify/memory/constitution.md`) is an unfilled template — all fields are placeholder text. No enforceable constitutional principles can be extracted. Gates are therefore evaluated against observable project conventions inferred from the existing codebase.

| Convention (inferred) | This feature | Status |
|-----------------------|-------------|--------|
| Named exports only — no default class export | 5 named functions, no class | ✅ PASS |
| Pure utility modules in `src/lib/` — no side effects | `calculator.ts` is stateless, no I/O | ✅ PASS |
| `strict: true` TypeScript, `verbatimModuleSyntax` | All types explicit; `import type` where needed | ✅ PASS |
| `.js` extensions in ESM imports (NodeNext) | Enforced in test and any future consumer | ✅ PASS |
| No runtime dependency additions | Calculator uses only `Math.*` | ✅ PASS |
| Tests exist alongside modules | `tests/unit/calculator.test.ts` added | ✅ PASS |

**Post-Phase-1 re-check**: No design changes introduced violations. All gates remain PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-simple-calculator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── calculator-api.ts  # Phase 1 output — typed function signatures + JSDoc
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
└── lib/
    ├── calculator.ts        # NEW — calculator library module (5 exported functions)
    ├── encoded-config.ts    # existing
    └── jira-status.ts       # existing

tests/
└── unit/
    └── calculator.test.ts   # NEW — Vitest unit test suite

package.json                 # MODIFIED — add vitest devDependency + test script
```

**Structure Decision**: Single-project layout (Option 1). The calculator is a single-file utility module — identical in shape to `encoded-config.ts` and `jira-status.ts`. No new directories in `src/` are required. The test file goes under `tests/unit/` (new subdirectory, consistent with single-project convention).

## Complexity Tracking

> No constitution violations — this section is not required.
