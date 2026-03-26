/**
 * Simple calculator — supports addition, subtraction, multiplication,
 * division, and sine (radians).
 */

/** Returns the sum of a and b. */
export function add(a: number, b: number): number {
  return a + b;
}

/** Returns the difference of a and b (a − b). */
export function subtract(a: number, b: number): number {
  return a - b;
}

/** Returns the product of a and b. */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Returns the quotient of a divided by b.
 * @throws {Error} when b is 0.
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/**
 * Returns the sine of x, where x is in radians.
 * Example: sin(Math.PI / 6) ≈ 0.5
 */
export function sin(x: number): number {
  return Math.sin(x);
}
