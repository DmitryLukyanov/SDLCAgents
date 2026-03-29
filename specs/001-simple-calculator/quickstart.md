# Quickstart: Simple Calculator (TC-5)

**Module**: `src/lib/calculator.ts`  
**Stack**: TypeScript / Node.js ≥20 / ESM  

---

## Installation

No new runtime dependencies. The calculator module uses only built-in JavaScript (`Math.*`).

Add the test framework (one-time, dev only):

```bash
npm install --save-dev vitest@4.1.2
```

Add a test script to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## Usage

Import individual functions by name. All functions are pure and synchronous.

```typescript
import { add, subtract, multiply, divide, sinDeg } from './src/lib/calculator.js';
// NodeNext ESM requires the .js extension — even when importing .ts source files.
```

### Arithmetic

```typescript
add(8, 5)        // → 13
subtract(10, 4)  // → 6
multiply(6, 7)   // → 42
divide(20, 4)    // → 5
divide(1, 3)     // → 0.3333   (4 dp, non-integer)
```

### Trigonometry

```typescript
sinDeg(0)    // → 0
sinDeg(90)   // → 1
sinDeg(30)   // → 0.5
sinDeg(-90)  // → -1
sinDeg(45)   // → 0.7071
sinDeg(180)  // → 0           (floating-point artifact resolved by rounding)
```

### Error handling

```typescript
try {
  divide(7, 0);
} catch (e) {
  // e.message === "Cannot divide by zero"
}

try {
  add(null as unknown as number, 5);
} catch (e) {
  // e instanceof TypeError
  // e.message === "Invalid input: expected a finite number for 'a', got object"
}

try {
  add(Number.MAX_SAFE_INTEGER + 1, 0);
} catch (e) {
  // e instanceof RangeError
  // e.message === "Input exceeds supported numeric range"
}
```

---

## Running Tests

```bash
npm test
# → vitest run tests/unit/calculator.test.ts
```

---

## Rounding Behaviour

| Expression | Raw result | Returned |
|------------|-----------|---------|
| `add(8, 5)` | `13` | `13` |
| `divide(1, 3)` | `0.33333…` | `0.3333` |
| `sinDeg(45)` | `0.70710…` | `0.7071` |
| `sinDeg(30)` | `0.5` | `0.5` |

Results are rounded to **exactly 4 decimal places** for non-integers. Integer results are returned as whole numbers — no trailing `.0000`.

---

## What's Not Included

- `cos`, `tan`, `cot`, or any other trig functions — out of scope by spec (FR-006).
- Expression parsing (`"8 + 5"` as a string) — out of scope (FR-011).
- Chained operations (`2 + 3 * 4`) — out of scope.
- CLI or REPL interface — out of scope for this version.
- Radians input for `sinDeg` — degrees only.
