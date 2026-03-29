# Implementation Plan: Simple Calculator

**Branch**: `copilot/create-simple-calculator` | **Date**: 2025-07-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/copilot/create-simple-calculator/spec.md`

## Summary

Implement a stateless TypeScript library module that exports five named functions — `add`, `subtract`, `multiply`, `divide`, and `sin` — operating on JavaScript `number` (IEEE 754 float64) values. The library validates all inputs at runtime, throws `TypeError` on invalid input, throws `Error` on division by zero, and delegates sine computation to the built-in `Math.sin`. No external runtime dependencies are required. Tests are written with the Node.js built-in `node:test` runner (zero new dependencies; Node 20 already required by the project).

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js ≥ 20  
**Primary Dependencies**: None (runtime); `tsx` (dev, already present) for test execution  
**Storage**: N/A — pure in-memory computation, no persistence  
**Testing**: Node.js built-in `node:test` + `assert` — no additional test framework dependency  
**Target Platform**: Node.js ESM module (consumed by any TypeScript/JavaScript project using `NodeNext` resolution)  
**Project Type**: Library — named exports only, no CLI entry point  
**Performance Goals**: < 1 ms per call for any single invocation (SC-004); pure CPU-bound computation  
**Constraints**: Stateless; IEEE 754 float64 bounds; no application-level numeric limits; no degree conversion  
**Scale/Scope**: Small, self-contained module (~100 LOC implementation + ~150 LOC tests)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> **Status: PASS** — The constitution file is a placeholder template with no binding project-specific rules ratified. The design below follows the spirit of the placeholder principles (library-first, testable, simple, stateless) without any violations.

| Principle (template) | Assessment |
|---|---|
| Library-first | ✅ Delivered as a standalone named-export TypeScript module |
| Testable / Test-first | ✅ Unit tests cover all branches before implementation |
| Simplicity / YAGNI | ✅ No abstraction beyond the five required functions |
| No unnecessary state | ✅ All functions are pure; no module-level mutable state |

## Project Structure

### Documentation (this feature)

```text
specs/copilot/create-simple-calculator/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/
│   └── calculator-api.md   ← Phase 1 output
└── tasks.md         ← Phase 2 output (created by /speckit.tasks — NOT this command)
```

### Source Code (repository root)

```text
src/
└── lib/
    └── calculator.ts       ← new file: five exported functions + shared validator

tests/
└── calculator/
    ├── arithmetic.test.ts  ← new: add / subtract / multiply / divide unit tests
    └── sin.test.ts         ← new: sin unit tests
```

**Structure Decision**: Single-project layout (Option 1). The library lives in `src/lib/` to match the existing pattern (see `src/lib/jira-status.ts`, `src/lib/encoded-config.ts`). Tests mirror the source tree under `tests/calculator/`.

## Complexity Tracking

> No constitution violations detected. Section not required.
