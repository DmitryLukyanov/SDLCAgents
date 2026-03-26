# Implementation Plan: Simple Calculator (TC-5)

**Branch**: `copilot/tc-5-create-simple-calculator` | **Date**: 2026-03-26 | **Spec**: `specs/TC-5/spec.md`

## Summary

Implement a pure TypeScript calculator module that exposes five functions: `add`, `subtract`, `multiply`, `divide`, and `sin`. Division by zero and non-finite inputs are rejected with descriptive errors. No cos/tan/cot or other trig functions are included.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict mode, NodeNext modules)  
**Primary Dependencies**: None (uses built-in `Math.sin`)  
**Storage**: N/A  
**Testing**: Local debug script (consistent with existing `tests/` style — no external test runner)  
**Target Platform**: Node.js ≥ 20  
**Project Type**: Library module  
**Performance Goals**: N/A (pure computation)  
**Constraints**: Must pass `tsc --noEmit` in strict mode  
**Scale/Scope**: Single module, five exported functions

## Constitution Check

- ✅ Small, reviewable change with clear intent.
- ✅ Preserves existing patterns (new `src/calculator/` sub-module, new `tests/calculator/` debug file).
- ✅ Tests added for new behavior.
- ✅ No secrets or environment variables involved.
- ✅ Input validation at system boundaries (non-finite inputs, division by zero).
- ✅ Codebase remains buildable and typecheck-clean after change.

## Project Structure

### Documentation (this feature)

```text
specs/TC-5/
├── spec.md      # Feature specification
├── plan.md      # This file
└── tasks.md     # Actionable task list
```

### Source Code

```text
src/
└── calculator/
    └── calculator.ts   # Calculator module (add, subtract, multiply, divide, sin)

tests/
└── calculator/
    └── calculator.local-debug.ts   # Local debug/test script (mirrors existing test style)
```

**Structure Decision**: Single-project structure matching the existing repository layout (`src/<module>/` + `tests/<module>/`).
