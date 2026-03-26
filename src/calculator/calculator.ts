/**
 * Simple Calculator Library (TC-5)
 *
 * Supports: add, subtract, multiply, divide, sin
 * Division by zero raises a CalculatorError.
 * The sin function accepts angles in radians.
 */

/** Thrown when an operation cannot be performed (e.g. division by zero). */
export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}

/** Returns the sum of `a` and `b`. */
export function add(a: number, b: number): number {
  return a + b;
}

/** Returns the difference of `a` minus `b`. */
export function subtract(a: number, b: number): number {
  return a - b;
}

/** Returns the product of `a` and `b`. */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Returns the quotient of `a` divided by `b`.
 * @throws {CalculatorError} when `b` is zero.
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new CalculatorError('Division by zero is not allowed');
  }
  return a / b;
}

/** Returns the sine of `angle` (in radians). */
export function sin(angle: number): number {
  return Math.sin(angle);
}
