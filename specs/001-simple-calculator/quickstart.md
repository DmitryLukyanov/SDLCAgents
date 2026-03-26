# Quickstart: Simple Calculator (TC-5)

**Branch**: `001-simple-calculator`

This guide gets you running and testing the `calc` CLI in under two minutes.

---

## Prerequisites

- Node.js ≥ 20 (`node --version`)
- `npm install` already run at repo root

---

## Run the Calculator

```bash
# From repo root — use tsx to execute TypeScript directly (no build step)

# Addition
npx tsx src/calculator/cli.ts add 3 5
# stdout: 8

# Subtraction
npx tsx src/calculator/cli.ts subtract 10 3
# stdout: 7

# Multiplication
npx tsx src/calculator/cli.ts multiply 2.5 4
# stdout: 10

# Division
npx tsx src/calculator/cli.ts divide 10 4
# stdout: 2.5

# Sine (radians)
npx tsx src/calculator/cli.ts sin 0
# stdout: 0

npx tsx src/calculator/cli.ts sin 1.5707963267948966
# stdout: 1  (≈ sin(π/2))
```

---

## Error Cases

```bash
# Division by zero → stderr + exit 1
npx tsx src/calculator/cli.ts divide 5 0
# stderr: Error: Division by zero

# Unsupported operation → stderr + exit 1
npx tsx src/calculator/cli.ts cos 1
# stderr: Error: Unsupported operation: "cos". Supported: add, subtract, multiply, divide, sin

# Non-numeric input → stderr + exit 1
npx tsx src/calculator/cli.ts add abc 3
# stderr: Error: Invalid input: "abc" is not a number
```

---

## Run Tests

```bash
# Run all calculator tests using Node.js built-in test runner
node --import tsx/esm --test tests/calculator/**/*.test.ts

# Watch mode (re-runs on file save)
node --import tsx/esm --test --watch tests/calculator/**/*.test.ts
```

---

## Add a Script Shortcut (optional)

Add to `package.json` `scripts`:

```json
"calc": "tsx src/calculator/cli.ts",
"test:calculator": "node --import tsx/esm --test tests/calculator/**/*.test.ts"
```

Then:

```bash
npm run calc -- add 3 5
npm run test:calculator
```

---

## File Layout

```
src/calculator/
├── calculator.ts   # Pure library: parse + compute, returns CalcResult
└── cli.ts          # Thin CLI entry-point: reads argv, prints to stdout/stderr

tests/calculator/
├── calculator.test.ts   # Unit tests for library (happy + error paths)
└── cli.test.ts          # Subprocess / integration tests for CLI contract
```
