# Implementation plan (Spec Kit — plan)

## Global directive (all agents)

Do not assume, ask

Use the stack already present in this repository. Favor minimal, incremental changes. Align with the constitution.

## Stack

- **Language:** TypeScript (strict), Node.js ≥ 20, ES modules (`"type": "module"`).
- **Module resolution:** `NodeNext` — use `.js` extensions in imports.
- **Build / check:** `tsc --noEmit` (`npm run check`).
- **Runtime:** `tsx` for direct TS execution.
- No new dependencies required — all operations use built-in `Math`.

## Design

```
src/
  calculator/
    calculator.ts        ← Calculator class (add, subtract, multiply, divide, sin)
    calculator-entry.ts  ← thin CLI wrapper (reads args, prints result)
tests/
  calculator/
    calculator.local-debug.ts  ← manual smoke-test (follows scrum-master.local-debug.ts pattern)
spec-output/
  TC-5/
    constitution.md
    spec.md
    plan.md   ← this file
    tasks.md
```

## Key decisions

1. **Class-based API** — matches the OOP style common in TypeScript; stateless static methods keep it simple.
2. **Divide-by-zero guard** — `divide(a, 0)` throws `new Error('Division by zero')` rather than returning `Infinity`.
3. **sin in radians** — delegates to `Math.sin`; no degree-to-radian conversion is added (scope: not requested).
4. **No external dependencies** — `Math.sin` is sufficient; no need for a math library.
5. **CLI entry point** — consistent with `dummy-agent-entry.ts` pattern; reads `process.argv`.

_Jira: TC-5_
