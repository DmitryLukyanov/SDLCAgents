/**
 * Simple calculator — TC-5
 *
 * Supported operations: add, subtract, multiply, divide, sin.
 * Only sin is provided from the trigonometric family; cos/tan/cot are out of scope.
 */

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides `a` by `b`.
 * @throws {Error} When `b` is zero.
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/** Returns the sine of `x` (angle in radians). */
export function sin(x: number): number {
  return Math.sin(x);
}
