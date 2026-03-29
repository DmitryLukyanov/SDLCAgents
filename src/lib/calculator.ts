/**
 * Simple Calculator library module (TC-5).
 *
 * Exports five pure functions: add, subtract, multiply, divide, sinDeg.
 * No runtime dependencies. No state. No I/O.
 *
 * All functions validate inputs via assertNumber() and round results via
 * formatResult() before returning.
 */

// ---------------------------------------------------------------------------
// Private helpers (non-exported)
// ---------------------------------------------------------------------------

/**
 * Validates that `x` is a finite number within ±Number.MAX_SAFE_INTEGER.
 *
 * Validation order:
 *   1. If typeof x !== 'number' or isNaN(x) → TypeError
 *   2. If !isFinite(x) or |x| > MAX_SAFE_INTEGER → RangeError
 *
 * @param x       - The value to validate.
 * @param argName - The argument name used in the error message.
 * @throws {TypeError}  When x is not a number or is NaN.
 * @throws {RangeError} When x is non-finite or exceeds ±Number.MAX_SAFE_INTEGER.
 */
function assertNumber(x: unknown, argName: string): asserts x is number {
  if (typeof x !== "number" || isNaN(x as number)) {
    throw new TypeError(
      `Invalid input: expected a finite number for '${argName}', got ${typeof x}`
    );
  }
  if (!isFinite(x as number) || Math.abs(x as number) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Input exceeds supported numeric range");
  }
}

/**
 * Rounds a computed result to 4 decimal places, dropping trailing zeros so
 * that integer results remain whole (e.g. 13.0000 → 13; 0.3333 stays 0.3333).
 * Normalizes IEEE 754 negative zero (-0) to positive zero (0).
 *
 * @param value - The number to format.
 * @returns The value rounded to at most 4 decimal places.
 */
function formatResult(value: number): number {
  const result = parseFloat(value.toFixed(4));
  // Normalize -0 to 0: (-0 === 0) is true, so this collapses both to +0
  return result === 0 ? 0 : result;
}

// ---------------------------------------------------------------------------
// Arithmetic operations
// ---------------------------------------------------------------------------

/**
 * Returns the sum of two numbers.
 *
 * @param a - First operand (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Second operand (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a + b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example add(8, 5)     // → 13
 * @example add(0.1, 0.2) // → 0.3
 */
export function add(a: number, b: number): number {
  assertNumber(a, "a");
  assertNumber(b, "b");
  return formatResult(a + b);
}

/**
 * Returns the difference of two numbers.
 *
 * @param a - Minuend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Subtrahend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a - b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example subtract(10, 4) // → 6
 * @example subtract(0, 5)  // → -5
 */
export function subtract(a: number, b: number): number {
  assertNumber(a, "a");
  assertNumber(b, "b");
  return formatResult(a - b);
}

/**
 * Returns the product of two numbers.
 *
 * @param a - First factor (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Second factor (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a * b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example multiply(6, 7)   // → 42
 * @example multiply(3, 1.5) // → 4.5
 */
export function multiply(a: number, b: number): number {
  assertNumber(a, "a");
  assertNumber(b, "b");
  return formatResult(a * b);
}

/**
 * Returns the quotient of two numbers.
 *
 * @param a - Dividend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Divisor  (must be a finite number within ±MAX_SAFE_INTEGER, and non-zero)
 * @returns `a / b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 * @throws {Error}      `"Cannot divide by zero"` if `b === 0`
 *
 * @example divide(20, 4) // → 5
 * @example divide(1, 3)  // → 0.3333
 * @example divide(7, 0)  // throws Error("Cannot divide by zero")
 */
export function divide(a: number, b: number): number {
  assertNumber(a, "a");
  assertNumber(b, "b");
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return formatResult(a / b);
}

// ---------------------------------------------------------------------------
// Trigonometric operations
// ---------------------------------------------------------------------------

/**
 * Returns the sine of an angle given in degrees.
 *
 * Conversion: `Math.sin(x * Math.PI / 180)`
 *
 * @param x - Angle in degrees (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns Sine of the angle, rounded to 4 dp if non-integer
 * @throws {TypeError}  If the argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If the argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example sinDeg(0)   // → 0
 * @example sinDeg(90)  // → 1
 * @example sinDeg(30)  // → 0.5
 * @example sinDeg(-90) // → -1
 * @example sinDeg(180) // → 0  (floating-point artifact resolved by rounding)
 *
 * @note ONLY sine is supported. cos, tan, cot are explicitly out of scope (FR-006).
 */
export function sinDeg(x: number): number {
  assertNumber(x, "x");
  const rad = x * (Math.PI / 180);
  return formatResult(Math.sin(rad));
}
