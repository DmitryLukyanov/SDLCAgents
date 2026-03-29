/**
 * Simple Calculator Library
 *
 * Exports five stateless named functions operating on IEEE 754 float64 numbers.
 * All inputs are validated at runtime; invalid inputs throw descriptive errors.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(
      `Argument '${name}' must be a valid number; received ${typeof value}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Exports — placeholders (replaced in later phases)
// ---------------------------------------------------------------------------

/**
 * Adds two numbers.
 *
 * @param a - The first addend.
 * @param b - The second addend.
 * @returns The sum `a + b` (IEEE 754 float64).
 * @throws {TypeError} If either argument is not a valid number (NaN or non-number).
 */
export function add(a: number, b: number): number {
  assertNumber(a, 'a');
  assertNumber(b, 'b');
  return a + b;
}

/**
 * Subtracts one number from another.
 *
 * @param a - The minuend.
 * @param b - The subtrahend.
 * @returns The difference `a - b` (IEEE 754 float64).
 * @throws {TypeError} If either argument is not a valid number (NaN or non-number).
 */
export function subtract(a: number, b: number): number {
  assertNumber(a, 'a');
  assertNumber(b, 'b');
  return a - b;
}

/**
 * Multiplies two numbers.
 *
 * @param a - The first factor.
 * @param b - The second factor.
 * @returns The product `a * b` (IEEE 754 float64).
 * @throws {TypeError} If either argument is not a valid number (NaN or non-number).
 */
export function multiply(a: number, b: number): number {
  assertNumber(a, 'a');
  assertNumber(b, 'b');
  return a * b;
}

/**
 * Divides one number by another.
 *
 * @param a - The dividend.
 * @param b - The divisor. Must not be zero.
 * @returns The quotient `a / b` (IEEE 754 float64).
 * @throws {TypeError} If either argument is not a valid number (NaN or non-number).
 * @throws {Error} If the divisor `b` is zero (`"Division by zero"`).
 */
export function divide(a: number, b: number): number {
  assertNumber(a, 'a');
  assertNumber(b, 'b');
  if (b === 0) {
    throw new Error('Division by zero: divisor must not be 0.');
  }
  return a / b;
}

/**
 * Computes the sine of an angle given in **radians**.
 *
 * Delegates directly to `Math.sin`, preserving all IEEE 754 edge-case
 * semantics (e.g. `sin(Infinity)` returns `NaN`).
 *
 * @param x - The angle in radians.
 * @returns `Math.sin(x)` (IEEE 754 float64).
 * @throws {TypeError} If the argument is not a valid number (NaN or non-number).
 */
export function sin(x: number): number {
  assertNumber(x, 'x');
  return Math.sin(x);
}
