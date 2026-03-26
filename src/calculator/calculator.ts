/**
 * Simple calculator module with basic arithmetic and trigonometric operations.
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
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}

export function sin(a: number): number {
  return Math.sin(a);
}

export function formatResult(n: number): string {
  return parseFloat(n.toFixed(10)).toString();
}
