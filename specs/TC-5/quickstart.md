# Quickstart: Simple Calculator (TC-5)

**Feature**: TC-5 — Simple Calculator
**Date**: 2025-07-18

This guide shows how to use and test the calculator once implemented.

---

## Prerequisites

- Node.js ≥ 20 installed
- Project dependencies installed: `npm install` (no new dependencies for this feature)

---

## Using the CLI

Run the CLI directly with `tsx` (no compile step needed):

```bash
npx tsx src/calculator/calculator-cli.ts <args>
```

### Basic arithmetic

```bash
# Addition
npx tsx src/calculator/calculator-cli.ts 10 + 5
# Output: 15

# Subtraction
npx tsx src/calculator/calculator-cli.ts 10 - 3
# Output: 7

# Multiplication
npx tsx src/calculator/calculator-cli.ts 4 '*' 2.5
# Output: 10
# Note: * is a shell glob — quote it or the shell will expand it

# Division
npx tsx src/calculator/calculator-cli.ts 1 / 3
# Output: 0.3333333333

# Division (whole-number result)
npx tsx src/calculator/calculator-cli.ts 10 / 2
# Output: 5
```

### Sine (radians)

```bash
# sin(0) = 0
npx tsx src/calculator/calculator-cli.ts sin 0
# Output: 0

# sin(π/2) ≈ 1
npx tsx src/calculator/calculator-cli.ts sin 1.5707963268
# Output: 1

# sin of a negative angle
npx tsx src/calculator/calculator-cli.ts sin -1.5707963268
# Output: -1
```

### Negative operands (no quoting required)

```bash
# Negative left operand
npx tsx src/calculator/calculator-cli.ts -5 + 3
# Output: -2

# Both negative
npx tsx src/calculator/calculator-cli.ts -5 '*' -3
# Output: 15

# Subtract a negative
npx tsx src/calculator/calculator-cli.ts 10 - -5
# Output: 15
```

### Error cases (exit code 1)

```bash
# Division by zero
npx tsx src/calculator/calculator-cli.ts 1 / 0
# stderr: Error: Division by zero is not allowed
# exit: 1

# Non-numeric input
npx tsx src/calculator/calculator-cli.ts foo + 5
# stderr: Error: "foo" is not a valid number
# exit: 1

# Unsupported operator
npx tsx src/calculator/calculator-cli.ts 1 cos 1
# stderr: Error: Unsupported operator "cos". Supported operators: +, -, *, /, sin
# exit: 1

# Wrong number of arguments
npx tsx src/calculator/calculator-cli.ts 42
# stderr: Usage: calc <number> <+|-|*|/> <number>
#                calc sin <number>
# exit: 1
```

---

## Using the Library

```typescript
import { add, subtract, multiply, divide, sin, formatResult } from './src/calculator/calculator.js';

// Basic operations
console.log(add(2, 3));        // 5
console.log(subtract(10, 4));  // 6
console.log(multiply(3, 7));   // 21
console.log(divide(1, 3));     // 0.3333333333333333 (raw float)

// Formatted output
console.log(formatResult(divide(1, 3)));  // "0.3333333333"
console.log(formatResult(add(2, 3)));     // "5"

// Trigonometry
console.log(sin(Math.PI / 2));  // ≈ 0.9999999999999999

// Error handling
try {
  divide(1, 0);
} catch (e) {
  console.error((e as Error).message);  // "Division by zero is not allowed"
}
```

---

## Running Tests

```bash
node --import tsx/esm --test tests/calculator/calculator.test.ts
```

Expected output (all tests passing):

```
▶ add
  ✔ adds two positive integers (1ms)
  ✔ adds floats (0ms)
  ✔ adds negative numbers (0ms)
▶ add (3ms)

▶ divide
  ✔ divides normally (0ms)
  ✔ produces fractional result with precision (0ms)
  ✔ throws on division by zero (0ms)
▶ divide (1ms)

... (all tests pass)
```

---

## TypeScript Type Checking

```bash
npm run check
```

All calculator source files must pass `tsc --noEmit` with no errors under strict mode.
