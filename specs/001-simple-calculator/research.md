# Research: Simple Calculator (TC-5)

**Branch**: `001-simple-calculator` | **Phase**: 0 — Research

---

## 1. Test Runner

**Decision**: Node.js built-in `node:test` + `node:assert`

**Rationale**: The project has no existing test framework. `node:test` ships with Node.js ≥ 18 and the project already requires ≥ 20, so it adds zero dependencies and zero configuration. It produces TAP-compatible output, supports `--watch`, and runs with `tsx` in ESM mode out of the box.

**Alternatives considered**:
- **Vitest** — well-matched to TypeScript/ESM but adds a new dependency and a `vite.config.ts` (YAGNI for a small feature).
- **Jest** — requires `ts-jest` or Babel transpilation, not a good fit for native ESM + `NodeNext` resolution.
- **Mocha** — older ecosystem; needs additional assertion and mock libraries; more setup than `node:test`.

---

## 2. CLI Entry-Point Pattern

**Decision**: Thin entry-point `src/calculator/cli.ts` that calls into a pure library module; invoked via `tsx src/calculator/cli.ts`.

**Rationale**: Every existing CLI in the repo (e.g. `src/dummy-agent/dummy-agent-entry.ts`, `src/scrum-agent/scrum-master.ts`) follows the same thin-entry → core-library split. The calculator should match that convention. `tsx` already installed — no new runner needed.

**Alternatives considered**:
- Compiled binary with `pkg` — overkill for an internal dev tool; `tsx` is already available.
- Single flat file — harder to unit-test pure logic without starting a subprocess; not aligned with existing split.

---

## 3. Argument Parsing

**Decision**: `process.argv.slice(2)` with manual validation — no third-party parser.

**Rationale**: The CLI grammar is trivially simple: one keyword + zero or two numeric strings. A full parser library (e.g. `yargs`, `commander`) is unnecessary overhead and adds a dependency for something that can be handled in ~15 lines.

**Alternatives considered**:
- `yargs` / `commander` — both would require new `package.json` dependencies with no material benefit for a two-argument CLI.

---

## 4. Numeric Precision

**Decision**: Standard JavaScript `number` (IEEE 754 double) throughout; no arbitrary-precision library.

**Rationale**: The spec requires "meaningful decimal precision" (SC-002 references 6 significant figures). IEEE 754 double gives ~15–17 significant decimal digits, which far exceeds the requirement. `Math.sin()` is native and uses the platform's libm, which is correctly rounded to within 1 ULP.

**Overflow behaviour** (edge case from spec): Numbers that exceed `Number.MAX_VALUE` produce `Infinity`; `Number.MIN_VALUE` produces `0`. Both are documented JavaScript behaviours; the calculator will surface `Infinity` as output rather than error, matching spec note "behaviour should be documented."

**Alternatives considered**:
- `big.js` / `decimal.js` — needed only for financial exact-cent arithmetic; the spec does not require it.

---

## 5. Error Communication

**Decision**: Print a human-readable message to `stderr`, exit code `1`. Print result to `stdout`, exit code `0`.

**Rationale**: Matches UNIX conventions and the existing agents in this repo (they all `console.error(…); process.exit(1)` on failure). Separating stdout/stderr allows scripted consumers to distinguish result from error.

**Alternatives considered**:
- JSON envelope on stdout — over-engineered for a human-readable CLI calculator; spec says "human-readable error message."
- Single channel (stdout for everything) — breaks pipeline composition.

---

## 6. Module Location

**Decision**: `src/calculator/` sub-directory (library: `calculator.ts`, CLI: `cli.ts`).

**Rationale**: Keeps the feature self-contained under one directory, consistent with `src/dummy-agent/`, `src/scrum-agent/`, `src/spec-kit/` patterns.

**Alternatives considered**:
- `src/lib/calculator.ts` — the existing `src/lib/` folder holds shared cross-feature utilities; a standalone feature is better grouped in its own directory.
