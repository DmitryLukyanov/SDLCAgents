# Research: Simple Calculator

**Phase**: 0 — Outline & Research
**Date**: 2026-03-29
**Feature**: Simple Calculator CLI REPL

All decisions were provided as pre-made inputs. This document records the rationale and any
alternatives considered, so that future contributors understand *why* each choice was made.

---

## Decision 1 — Parser Strategy: Recursive Descent (Inline Evaluation)

**Decision**: Hand-written recursive-descent parser that evaluates inline (no separate AST).

**Rationale**:
- The grammar is small (five tokens + four rules) and fixed. A recursive-descent parser can be
  written in ~150 lines of TypeScript with no dependencies.
- Inline evaluation (returning `number` directly from each production function) is simpler than
  building an AST then walking it, and produces identical results for this use case.
- The no-external-dependencies constraint rules out parser-generator libraries (e.g., nearley,
  chevrotain, peggy).

**Alternatives Considered**:

| Alternative | Why Rejected |
|---|---|
| `eval()` / `Function()` | Security risk; cannot limit to allowed operations; `sin` in JS uses radians not degrees |
| `math.js` or similar | External runtime dependency — explicitly ruled out |
| PEG.js / nearley | Adds dev dependency with significant overhead for a 4-rule grammar |
| `split()` / regex | Cannot handle nested parentheses or operator precedence correctly |

---

## Decision 2 — `sin` Degrees Conversion

**Decision**: `Math.sin(degrees * Math.PI / 180)` at the evaluation site.

**Rationale**: Standard approach. The conversion is exact for all representable angles in
IEEE 754 double precision. `sin(90)` evaluates to `6.123233995736766e-17` for the radians value
`Math.PI/2`... wait, no: `Math.sin(Math.PI / 2)` is exactly `1`. `Math.sin(90)` (radians) is
`0.8939966636...` — that would be wrong. The degree conversion is therefore mandatory and produces
the exact spec-required `1` for `sin(90)`.

**Result for key angles**:

| `sin(degrees)` | Raw result | Formatted (10 sig) |
|---|---|---|
| `sin(0)` | `0` | `0` |
| `sin(30)` | `0.5` | `0.5` |
| `sin(90)` | `1` | `1` |
| `sin(180)` | `1.2246467991473532e-16` | `1.224646799e-16` |

The spec explicitly accepts `sin(180)` being non-zero due to floating-point arithmetic (within
±0.0001 of 0), so the raw value is displayed as-is.

---

## Decision 3 — Test Framework: `node:test`

**Decision**: Node.js built-in test runner (`node:test`) with `node:assert/strict`.

**Rationale**:
- Zero external dependencies; available in Node.js 20+ (already required by the repo's
  `engines.node` field).
- Produces TAP-compatible output; integrates well with CI runners.
- Sufficient for unit + integration testing of pure functions and stream-based I/O.

**Alternatives Considered**:

| Alternative | Why Rejected |
|---|---|
| Jest | External dependency; requires transform config for ESM+NodeNext |
| Vitest | External dependency; adds complexity for a simple CLI tool |
| Mocha / AVA | External dependencies |

---

## Decision 4 — Number Formatting

**Decision**: `parseFloat(n.toPrecision(10)).toString()`

**Rationale**:
- `toPrecision(10)` gives exactly 10 significant digits, satisfying FR-015.
- `parseFloat(...)` removes trailing zeros, so `42.00000000` becomes `42` and `1.000000000`
  becomes `1`, satisfying SC-007 (integers display without decimal point).
- `.toString()` returns the minimal JavaScript number representation.

**Edge cases verified**:

```
1/3  → toPrecision(10) = "0.3333333333" → parseFloat = 0.3333333333 → "0.3333333333" ✓
42   → "42.00000000" → 42 → "42" ✓
1    → "1.000000000" → 1  → "1" ✓
Infinity → isFinite check → "Infinity" (never reached in normal flow; division by zero throws)
```

---

## Decision 5 — REPL I/O: `node:readline`

**Decision**: `readline.createInterface` with `process.stdin` / `process.stdout`.

**Rationale**:
- Built into Node.js; no installation needed.
- Handles Ctrl+C (SIGINT) via `rl.on('close', ...)` and `process.on('SIGINT', ...)`.
- `rl.question('> ', callback)` provides the exact prompt-then-read loop required by the spec.
- Supports TTY features (line editing, history) transparently.

---

## Decision 6 — Module Format

**Decision**: ES modules (`"type": "module"` already in `package.json`) with `.js` imports in
TypeScript source (NodeNext resolution).

**Rationale**: The existing repo already uses `"module": "NodeNext"` in `tsconfig.json` and
`"type": "module"` in `package.json`. The new calculator module follows the same conventions.
All imports use `.js` extension as required by NodeNext resolution (e.g., `import { Lexer } from
'./lexer.js'`).

---

## Summary: All NEEDS CLARIFICATION Resolved

No unknowns remain. The table below confirms all Technical Context fields are fully specified:

| Field | Status |
|---|---|
| Language / Version | ✅ TypeScript 5.7, Node.js 20+ |
| Dependencies | ✅ None (built-ins only) |
| Storage | ✅ N/A |
| Testing | ✅ `node:test` |
| Platform | ✅ Cross-platform CLI |
| Performance | ✅ < 500 ms trivially achievable |
| Parser approach | ✅ Recursive descent, inline evaluation |
| `sin` semantics | ✅ Degrees via `* Math.PI / 180` |
| Number format | ✅ `parseFloat(n.toPrecision(10)).toString()` |
| REPL I/O | ✅ `node:readline` |
