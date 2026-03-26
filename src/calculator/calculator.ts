/** Simple calculator: add, subtract, multiply, divide, sin. */

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
 * Divides a by b.
 * @throws {RangeError} When b is zero.
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError('Division by zero');
  }
  return a / b;
}

/** Returns the sine of a (in radians). */
export function sin(a: number): number {
  return Math.sin(a);
}
