# Research: Simple Calculator (TC-5)

**Phase**: 0 — Outline & Research  
**Branch**: `001-simple-calculator`  
**Date**: 2026-03-29  

All NEEDS CLARIFICATION items resolved below. Decisions are binding for Phase 1 design.

---

## R-001 — File Placement & Module Role

- **Decision**: Implement the calculator as `src/lib/calculator.ts`
- **Rationale**: The existing `src/lib/` directory is the established home for self-contained, side-effect-free utility modules. Both existing lib modules (`encoded-config.ts`, `jira-status.ts`) are pure function collections with named exports and JSDoc block comments — identical to what the calculator requires.
- **Alternatives considered**: `src/calculator/calculator.ts` (a dedicated directory). Rejected — a directory is only warranted when a module has multiple files (types, helpers, entry). The calculator is a single-file module with no sub-components.

---

## R-002 — Test Framework

- **Decision**: Add **Vitest 4.1.2** as a `devDependency`
- **Rationale**: The project has no test framework. Vitest is the best fit because:
  1. Native ESM support — no additional configuration required for `"type": "module"` projects.
  2. TypeScript out of the box — no `ts-jest` or Babel needed; works with the project's existing `tsx`/`strict` setup.
  3. Jest-compatible API (`describe`, `it`, `expect`) — minimal learning curve.
  4. Node.js ≥20 compatible — no engine conflict.
  5. Zero known security vulnerabilities (checked against GitHub Advisory Database).
- **Alternatives considered**:
  - **`node:test` (built-in)**: No extra dependency, but assertion library is minimal and matchers are unfamiliar. Viable but inferior DX.
  - **Jest + `ts-jest`**: Requires additional ESM configuration (`extensionsToTreatAsEsm`, `transform`). More setup friction for a project that already avoids a build step.

---

## R-003 — Input Validation Strategy

- **Decision**: Two-tier guard applied uniformly in every exported function:
  1. **Type guard** — `typeof x !== 'number' || isNaN(x)` → throw `TypeError` with message `"Invalid input: expected a finite number, got <type>"`.
  2. **Range guard** — `!isFinite(x) || Math.abs(x) > Number.MAX_SAFE_INTEGER` → throw `RangeError` with message `"Input exceeds supported numeric range"`.
- **Rationale**: FR-007 specifies `TypeError` for non-numeric/NaN/null/undefined inputs. FR-009 specifies a range error for values exceeding `Number.MAX_SAFE_INTEGER` or outside IEEE 754. `Infinity`/`-Infinity` are not finite and therefore outside IEEE 754's *finite* representable set — the range guard catches them. Integer-valued floats larger than `MAX_SAFE_INTEGER` also trigger the range guard.
- **Implementation note**: The guard is extracted into a private `assertNumber(x: unknown, argName: string)` helper to avoid repetition across functions.
- **Alternatives considered**: Checking only `typeof x !== 'number'` (misses NaN). Checking only `!Number.isFinite(x)` (does not distinguish TypeError from RangeError as spec requires).

---

## R-004 — Rounding Rule Implementation

- **Decision**: `parseFloat(result.toFixed(4))`
- **Rationale**: `toFixed(4)` produces a string with exactly 4 decimal places. `parseFloat` converts it back to a `number`, automatically dropping trailing zeros (so `13.0000` becomes `13`, satisfying FR-008's "integer results without decimal padding" rule). This is idiomatic JS and avoids manual integer detection.
- **Edge case**: `divide(1, 3)` → `0.33333…` → `toFixed(4)` → `"0.3333"` → `parseFloat` → `0.3333` ✓
- **Edge case**: `add(8, 5)` → `13` → `toFixed(4)` → `"13.0000"` → `parseFloat` → `13` ✓
- **Alternatives considered**: Manual `Math.round(x * 10000) / 10000` — equivalent math but doesn't drop trailing zeros without additional integer check.

---

## R-005 — `sinDeg` Degree-to-Radian Conversion

- **Decision**: `Math.sin(degrees * (Math.PI / 180))`
- **Rationale**: Standard conversion. `Math.PI / 180` is computed at call time; the constant is small enough that no precomputed constant is needed.
- **Known floating-point artifact**: `Math.sin(Math.PI)` returns ~`1.2246e-16` (not exactly 0). After rounding to 4 dp: `0.0000` → `parseFloat` → `0`. Verified: `sinDeg(180)` correctly returns `0`.
- **Known exact values**: `sinDeg(0)` = `0`, `sinDeg(90)` = `1`, `sinDeg(30)` = `0.5`, `sinDeg(-90)` = `-1`. All pass the ±0.0001 tolerance in SC-002.

---

## R-006 — TypeScript Module Conventions (NodeNext ESM)

- **Decision**: Use `.js` extension in all import paths (NodeNext resolution requirement); use `export` only for the five public functions; no default export; `type` keyword on type-only imports.
- **Rationale**: `tsconfig.json` uses `"moduleResolution": "NodeNext"` and `"verbatimModuleSyntax": true`. NodeNext requires explicit `.js` extensions in ESM imports. `verbatimModuleSyntax` requires `import type` for type-only imports.
- **Impact**: Test file imports `calculator.ts` using the `.js` extension (`../../../src/lib/calculator.js`), as seen in the existing debug test.

---

## R-007 — No Build Step Required

- **Decision**: No compilation step; `tsx` is used for running TypeScript directly. `noEmit: true` in `tsconfig.json`.
- **Rationale**: The project's existing pattern is to run TypeScript directly with `tsx` and type-check with `tsc --noEmit`. Vitest handles TypeScript internally via its bundler; no separate transpilation step is required.
- **Impact on tasks**: The only `package.json` changes needed are: add `vitest` to `devDependencies`, add `"test": "vitest run"` script.
