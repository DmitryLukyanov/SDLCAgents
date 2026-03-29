# SDLCAgents Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-29

## Active Technologies

- TypeScript 5.7 + Node.js 20 built-ins (`node:readline`, `node:test`) (copilot/tc-5-create-simple-calculator)

## Project Structure

```text
src/calculator/      ← Lexer, Parser, Formatter, REPL, Entry point
tests/calculator/    ← node:test unit + integration tests
```

## Commands

- Run calculator: `npm run calculator` or `tsx src/calculator/index.ts`
- Run tests: `node --test tests/calculator/`
- Type-check: `npm run check`

## Code Style

- TypeScript strict mode (`strict: true`, `verbatimModuleSyntax`)
- ES modules with `.js` extension imports (NodeNext resolution)
- Zero runtime npm dependencies — Node.js built-ins only
- `node:test` + `node:assert/strict` for all tests

## Recent Changes

- copilot/tc-5-create-simple-calculator: Added TypeScript CLI calculator — recursive-descent parser, `sin` (degrees), REPL via `node:readline`, `node:test` tests

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
