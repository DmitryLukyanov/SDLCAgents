# Implementation plan (Spec Kit — plan)

## Global directive (all agents)

Do not assume, ask

## Stack & Constraints

- Language: TypeScript (ESM, `"type": "module"`, `NodeNext` module resolution) — matches existing repo config.
- No new runtime dependencies; use only `Math` built-ins for arithmetic and trigonometry.
- Follow the single-responsibility pattern already used across `src/` modules.

## Architecture

```
src/
  calculator/
    calculator.ts        ← pure-function library (add, subtract, multiply, divide, sin)
    calculator-entry.ts  ← CLI entry point (reads args, calls calculator, prints result)
tests/
  calculator/
    calculator.local-debug.ts  ← runnable demo that exercises all operations
```

## Design decisions

1. **Pure functions only** — no class, no state. Each exported function takes numeric arguments and returns a number (or throws for divide-by-zero).
2. **Radians for sin** — `Math.sin` operates in radians; document this in the JSDoc.
3. **Divide-by-zero guard** — throw `new Error('Division by zero')` rather than returning `Infinity` to catch programmer errors early.
4. **CLI entry** — accepts `<operation> <a> [b]` args; allows manual testing and future workflow integration.

## Tasks (see tasks.md)

1. Create `src/calculator/calculator.ts`
2. Create `src/calculator/calculator-entry.ts`
3. Update `package.json` with `"calculator"` script
4. Create `tests/calculator/calculator.local-debug.ts`
5. Run `npm run check` to verify typecheck passes

_Jira: TC-5_
