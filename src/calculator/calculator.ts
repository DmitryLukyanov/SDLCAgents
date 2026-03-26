/**
 * Simple calculator library.
 *
 * Supports: add, subtract, multiply, divide, sin.
 * sin argument is in radians (matches Math.sin).
 * divide throws an Error when the divisor is zero.
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

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export function sin(x: number): number {
  return Math.sin(x);
}
