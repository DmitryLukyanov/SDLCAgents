# Implementation Plan: Simple Calculator (TC-5)

**Branch**: `001-simple-calculator` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-simple-calculator/spec.md`

## Summary

Implement a stateless TypeScript calculator module exposing five ESM named exports — `add`, `subtract`, `multiply`, `divide`, and `sin` — placed in `src/calculator/`. All functions accept `number` parameters (non-number types rejected at runtime), return a `number`, and signal errors by throwing `Error` objects. Mathematical NaN results (e.g. `sin(Infinity)`) are valid outcomes and are not thrown. Division by zero throws; all other arithmetic follows IEEE 754. Tests run via Node.js built-in `node:test` with no additional test-runner dependencies.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js ≥ 20  
**Primary Dependencies**: None (runtime); `tsx` + `typescript` dev-only (existing)  
**Storage**: N/A — stateless pure functions  
**Testing**: Node.js built-in `node:test` + `node:assert` (no additional install required)  
**Target Platform**: Node.js ESM library module (consumed programmatically)  
**Project Type**: Library module (src/calculator/)  
**Performance Goals**: < 10 ms per call (trivially met — pure math, no I/O)  
**Constraints**: ESM (`"type": "module"`, NodeNext resolution); `.js` extensions on all local imports; `strict: true`  
**Scale/Scope**: 5 exported functions, ~2 source files, ~2 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Note**: The project constitution (`/.specify/memory/constitution.md`) contains only placeholder template text with no ratified principles. There are **no active constitutional gates** to evaluate. This plan proceeds under the codebase's observable conventions (TypeScript strict ESM, JSDoc headers, named exports, `throw new Error(...)`) as the de-facto governance baseline.

| Gate | Status | Notes |
|------|--------|-------|
| Consistent module format (ESM NodeNext) | ✅ PASS | Matches `package.json "type":"module"` + `tsconfig.json "module":"NodeNext"` |
| Named exports (no default exports observed) | ✅ PASS | All existing src files use named exports |
| Strict TypeScript (`strict: true`) | ✅ PASS | Enforced via `tsconfig.json` |
| Error signalling via `throw new Error(...)` | ✅ PASS | Matches existing codebase pattern |
| No new external runtime dependencies | ✅ PASS | Pure math — only `Math.sin` needed |
| Test runner: use built-in `node:test` | ✅ PASS | Avoids adding test-framework dependency |

**Post-Phase 1 re-check**: Confirmed — single-module library layout adds no complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-simple-calculator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── calculator-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
└── calculator/
    ├── index.ts          # Barrel — re-exports all public functions
    ├── arithmetic.ts     # add, subtract, multiply, divide
    └── trigonometry.ts   # sin

tests/
└── calculator/
    ├── arithmetic.test.ts
    └── trigonometry.test.ts
```

**Structure Decision**: Single-module library layout (Option 1 simplified). Calculator code lives under `src/calculator/` as requested. Tests mirror the source tree under `tests/calculator/`. No CLI layer, no backend/frontend split — this is a pure library module.

## Complexity Tracking

> No constitution violations identified. Table not required.
