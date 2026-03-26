# Implementation Plan: Simple Calculator (TC-5)

**Branch**: `copilot/tc-5-create-simple-calculator-cd96834b-645d-40f7-af53-489b69aa08d2`
**Date**: 2025-07-18
**Spec**: [`specs/TC-5/spec.md`](./spec.md)
**Input**: Feature specification from `/specs/TC-5/spec.md`

## Summary

Implement a stateless calculator that supports addition, subtraction, multiplication, division, and sine (radians only). Delivered as two artifacts: a pure TypeScript library module (`src/calculator/calculator.ts`) with named function exports, and a thin CLI entry point (`src/calculator/calculator-cli.ts`) that parses `process.argv`, delegates to the library, formats output (≤10 decimal places, trailing zeros trimmed), and exits with code `1` on any error. Tests use the Node.js built-in `node:test` runner — zero new dependencies.

---

## Technical Context

**Language/Version**: TypeScript 5.7 / Node.js ≥ 20  
**Primary Dependencies**: None (zero new runtime or dev dependencies)  
**Storage**: N/A — fully stateless, single-invocation  
**Testing**: `node:test` built-in (Node ≥ 20), `node:assert/strict`  
**Target Platform**: Node.js 20+ (Linux/macOS/Windows; same runtime as existing project)  
**Project Type**: Dual — importable TypeScript library + CLI tool  
**Performance Goals**: Single CLI invocation completes in < 1 second (SC-001, SC-002) — trivially met for pure math with no I/O  
**Constraints**: ESM-only (`"type": "module"`, `module: "NodeNext"`); strict TypeScript; `noEmit: true`; all imports use `.js` extension (NodeNext resolution); negative number tokens must be treated as numbers, not flags (FR-011)  
**Scale/Scope**: Single-file library + single-file CLI; all operations are pure math functions

---

## Constitution Check

*The constitution file contains placeholder template text and has not been populated with project-specific principles. The plan therefore applies the project-level constraints derived from the repository itself:*

| Constraint | Source | Status |
|---|---|---|
| ESM imports with `.js` extension | `tsconfig.json` (`NodeNext`) + existing source files | ✅ Plan complies — all imports will use `.js` extensions |
| `strict: true` TypeScript | `tsconfig.json` | ✅ No `any`, no non-null assertions without justification |
| `noEmit: true` — run via `tsx` | `package.json` scripts | ✅ CLI uses `tsx` at runtime; no compile step needed |
| Zero new dependencies | Spec clarification Q5 + `package.json` | ✅ `node:test` is built-in; no npm installs |
| Node.js ≥ 20 | `package.json` `engines` field | ✅ `node:test` and `node:assert/strict` available |
| Error handling via `throw Error` | Spec clarification Q1 + FR-009 | ✅ Library throws; CLI catches and prints to stderr |
| Exit code `1` for all errors | Spec clarification Q2 + FR-006/007/008 | ✅ CLI exits `1` on any error condition |
| Output precision ≤ 10 d.p., trimmed | Spec clarification Q3 + FR-010 | ✅ `parseFloat(n.toFixed(10)).toString()` |
| Negative numbers without quoting | Spec clarification Q4 + FR-011 | ✅ Custom `Number(token)` parser, not a flag parser |

**Gate result**: ✅ PASS — no violations. No complexity justification table required.

---

## Project Structure

### Documentation (this feature)

```text
specs/TC-5/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── calculator-api.md ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks, NOT this command)
```

### Source Code (repository root)

```text
src/
└── calculator/
    ├── calculator.ts          ← Pure library: named exports for add/subtract/multiply/divide/sin
    └── calculator-cli.ts      ← CLI entry point: argv parsing, formatting, error handling

tests/
└── calculator/
    └── calculator.test.ts     ← node:test suite covering library + integration scenarios
```

**Structure Decision**: Single-project, feature sub-directory under `src/calculator/` — matches existing pattern of `src/<module-name>/<files>.ts` (e.g., `src/scrum-agent/`, `src/dummy-agent/`, `src/lib/`). No new top-level directories needed.

---

## Phase 0: Research

*See [`research.md`](./research.md) for full findings. Summary:*

All NEEDS CLARIFICATION items were pre-resolved in the spec's Clarifications section. Research confirmed:

1. **`node:test`** is fully available in Node 20+ with ESM (`import { test, describe } from 'node:test'`), requires zero extra setup.
2. **`parseFloat(n.toFixed(10)).toString()`** correctly trims trailing zeros and omits the decimal point for whole numbers — confirmed for all spec examples.
3. **Negative CLI arguments** (`-5`) are safe to handle via custom `Number(token)` parsing; the Node.js runtime passes them through `process.argv` as plain strings. No flag-parser library is needed or safe to use here.
4. **`Math.sin`** is the correct built-in to delegate to; no external trig library needed.
5. **`tsx`** (already in devDependencies) correctly handles ESM TypeScript at runtime and is the execution vehicle for both the CLI and tests.

---

## Phase 1: Design & Contracts

### Library Design (`src/calculator/calculator.ts`)

The library exposes five named exports — one per supported operation. All functions are synchronous and pure (no side effects, no I/O).

```typescript
// Conceptual signatures (see data-model.md for full types)
export function add(a: number, b: number): number
export function subtract(a: number, b: number): number
export function multiply(a: number, b: number): number
export function divide(a: number, b: number): number   // throws Error on b === 0
export function sin(x: number): number                  // delegates to Math.sin
```

Error contract: `divide(a, 0)` throws `new Error('Division by zero is not allowed')`. All other inputs that are valid JavaScript numbers (including `Infinity`, `-Infinity`) pass through to JavaScript's arithmetic/`Math.sin` without special treatment at the library layer — the CLI layer rejects non-finite inputs before calling the library.

### CLI Design (`src/calculator/calculator-cli.ts`)

**Invocation forms**:

| Form | argv (after slice) | Example |
|---|---|---|
| Binary operation | `[num, op, num]` | `10 + 5`, `-5 - 3`, `1 / 3` |
| Unary sin | `[sin, num]` | `sin 1.5708` |

**Argument parsing algorithm**:
1. `const args = process.argv.slice(2)`
2. If `args[0] === 'sin'` and `args.length === 2` → unary path
3. If `args.length === 3` and `args[1]` is one of `+`, `-`, `*`, `/` → binary path
4. Otherwise → usage error (exit 1)

**Number parsing** (`parseArg`):
```
const n = Number(token)
if (!Number.isFinite(n)) throw Error(`"${token}" is not a valid number`)
return n
```
`Number('-5')` → `-5` (handles FR-011 without any special flag-handling code).

**Output formatting** (`formatResult`):
```
parseFloat(n.toFixed(10)).toString()
```
Verified for spec examples: `2+3 → "5"`, `1/3 → "0.3333333333"`, `1/4 → "0.25"`.

**Error output**: All errors print to `process.stderr` (not `stdout`) then exit with code `1`.

**Supported operators error message**: `Unsupported operator "${op}". Supported operators: +, -, *, /, sin`

### Test Design (`tests/calculator/calculator.test.ts`)

Uses `node:test` with `describe`/`test` structure and `node:assert/strict`. Run command:

```bash
node --import tsx/esm --test tests/calculator/calculator.test.ts
```

Test groups:
1. **`add`** — integers, floats, negatives
2. **`subtract`** — positive result, zero result, negative result
3. **`multiply`** — integers, floats, by-zero (valid: returns `0`)
4. **`divide`** — normal, fractional (precision), by-zero throws
5. **`sin`** — `sin(0)=0`, `sin(π/2)≈1`, `sin(-π/2)≈-1`, large number (no crash)
6. **`formatResult`** (exported helper) — whole number, trailing zero trim, max 10 d.p.
7. **CLI integration** — spawn `tsx src/calculator/calculator-cli.ts` via `child_process.spawnSync`; assert stdout, stderr, exit code for representative cases including negative operands and error paths

*See [`contracts/calculator-api.md`](./contracts/calculator-api.md) and [`data-model.md`](./data-model.md) for full interface definitions.*
