# Quickstart: Simple Calculator (TC-5)

**Module**: `src/calculator/index.ts`  
**Branch**: `001-simple-calculator`

---

## Installation

No additional packages required. The calculator is a pure TypeScript module using only built-in `Math` functions and existing project tooling.

---

## Using the Calculator

Import the named exports you need:

```typescript
import { add, subtract, multiply, divide, sin } from './src/calculator/index.js';
```

> **Important**: Use `.js` extensions on all local imports — required by NodeNext ESM resolution even when importing `.ts` source files (TypeScript resolves the extension at compile time).

---

## Basic Arithmetic

```typescript
import { add, subtract, multiply, divide } from './src/calculator/index.js';

// Addition
const sum = add(3, 4);           // 7
const sum2 = add(0.1, 0.2);      // 0.30000000000000004 (IEEE 754)

// Subtraction
const diff = subtract(10, 4);    // 6
const neg = subtract(3, 5);      // -2

// Multiplication
const product = multiply(6, 7);  // 42
const large = multiply(1e308, 2); // Infinity (IEEE 754 overflow — not an error)

// Division
const quotient = divide(10, 4);  // 2.5
const neg2 = divide(-9, 3);      // -3
```

---

## Sine Function

```typescript
import { sin } from './src/calculator/index.js';

sin(0);               // 0
sin(Math.PI / 2);     // ≈ 1 (floating-point: 0.9999999999999999...)
sin(Math.PI);         // ≈ 0 (floating-point: 1.2246467991473532e-16)
sin(-Math.PI / 2);    // ≈ -1
sin(Infinity);        // NaN  ← valid mathematical result, not an error
```

> Angles are in **radians**. To convert degrees: `sin(degrees * Math.PI / 180)`.

---

## Error Handling

All errors are thrown as standard `Error` objects. Use `try/catch`:

```typescript
import { divide, add } from './src/calculator/index.js';

// Division by zero
try {
  divide(10, 0);
} catch (err) {
  console.error((err as Error).message); // 'Division by zero'
}

// Non-numeric input
try {
  add('3' as unknown as number, 4);
} catch (err) {
  console.error((err as Error).message); // 'Argument "a" must be a number, got string'
}

// Missing argument (undefined)
try {
  add(undefined as unknown as number, 4);
} catch (err) {
  console.error((err as Error).message); // 'Argument "a" must be a number, got undefined'
}
```

---

## Running Tests

Tests use Node.js built-in `node:test` — no test framework installation needed.

```bash
# Run all calculator tests
node --import tsx/esm --test tests/calculator/arithmetic.test.ts tests/calculator/trigonometry.test.ts

# Or via tsx directly (if tsx supports --test pass-through)
npx tsx --test tests/calculator/arithmetic.test.ts
```

> The exact test run command will be confirmed during task implementation based on the tsx version's test integration support.

---

## What is NOT Supported

| Request | Status |
|---------|--------|
| `cos(x)` | ❌ Out of scope — TC-5 only |
| `tan(x)` | ❌ Out of scope — TC-5 only |
| `cot(x)` | ❌ Out of scope — TC-5 only |
| `add(1, 2, 3)` (chained) | ❌ Binary only — two operands max |
| `"3 + 4"` expression parsing | ❌ Programmatic API only |
| Angles in degrees | ❌ Radians only; caller converts |
