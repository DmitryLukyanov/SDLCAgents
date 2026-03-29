# Quickstart: Simple Calculator Library

**Feature**: Simple Calculator Library  
**Branch**: `copilot/create-simple-calculator`

---

## Prerequisites

- Node.js ≥ 20 (already required by project `package.json`)
- TypeScript 5.7 (already in `devDependencies`)
- `tsx` for running TypeScript files directly (already in `devDependencies`)

No new dependencies need to be installed.

---

## 1. Use the Library

Import and call the exported functions from `src/lib/calculator.ts`:

```typescript
import { add, subtract, multiply, divide, sin } from './src/lib/calculator.ts';

// Arithmetic
console.log(add(8, 5));          // 13
console.log(subtract(10, 4));    // 6
console.log(multiply(6, 7));     // 42
console.log(divide(15, 4));      // 3.75

// Trigonometry (radians only)
console.log(sin(0));             // 0
console.log(sin(Math.PI / 2));   // ≈ 1

// Error handling
try {
  divide(9, 0);
} catch (e) {
  console.error(e.message);     // "Division by zero: divisor must not be 0."
}

try {
  add('x' as any, 5);
} catch (e) {
  console.error(e.message);     // "Argument 'a' must be a valid number; received string."
}
```

---

## 2. Run Tests

Tests use the Node.js built-in `node:test` runner (no additional packages needed):

```bash
# Run all calculator tests
node --import tsx/esm --test tests/calculator/*.test.ts

# Run a single file
node --import tsx/esm --test tests/calculator/arithmetic.test.ts
```

Expected output:
```
▶ add
  ✔ returns correct sum for positive integers (1.23ms)
  ✔ returns correct sum for negative numbers (0.12ms)
  ...
▶ divide
  ✔ returns correct quotient (0.08ms)
  ✔ throws Error on division by zero (0.10ms)
  ...
▶ sin
  ✔ sin(0) returns 0 (0.07ms)
  ✔ sin(π/2) ≈ 1 (0.08ms)
  ...
```

---

## 3. Type-Check Only

```bash
npm run check
# runs: tsc --noEmit
```

The calculator module is included automatically via the `"include": ["src/**/*.ts", "tests/**/*.ts"]` setting in `tsconfig.json`.

---

## 4. File Locations

| File | Purpose |
|---|---|
| `src/lib/calculator.ts` | Library implementation |
| `tests/calculator/arithmetic.test.ts` | Unit tests for `add`, `subtract`, `multiply`, `divide` |
| `tests/calculator/sin.test.ts` | Unit tests for `sin` |
| `specs/copilot/create-simple-calculator/contracts/calculator-api.md` | Full API contract |
| `specs/copilot/create-simple-calculator/data-model.md` | Type definitions and invariants |

---

## 5. Key Design Points

- **Radians only**: `sin` does not convert degrees. Pass `angle * Math.PI / 180` to convert.
- **NaN is rejected**: Passing `NaN` throws `TypeError`. Only `Infinity`/`-Infinity` are valid non-finite inputs.
- **Stateless**: No state is shared between calls. Safe for concurrent use.
- **No extra exports**: `cos`, `tan`, `cot` are not exported by design.
