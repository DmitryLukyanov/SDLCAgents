/**
 * Simple calculator module.
 *
 * Supported operations: add, subtract, multiply, divide, sin.
 * Inputs must be finite numbers. Division by zero throws an explicit error.
 * Note: only sin is provided — cos, tan, cot are intentionally excluded.
 */

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid input: "${name}" must be a finite number, got ${value}`);
  }
}

/** Returns the sum of a and b. */
export function add(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a + b;
}

/** Returns the difference of a and b (a - b). */
export function subtract(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a - b;
}

/** Returns the product of a and b. */
export function multiply(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a * b;
}

/**
 * Returns the quotient of a divided by b.
 * @throws {Error} if b is zero.
 */
export function divide(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}

/**
 * Returns the sine of x (x in radians).
 * Only sin is supported — cos, tan, and cot are intentionally excluded per spec TC-5.
 */
export function sin(x: number): number {
  assertFinite(x, 'x');
  return Math.sin(x);
}
