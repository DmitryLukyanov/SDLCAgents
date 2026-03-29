/**
 * Pure calculator functions with strict input validation.
 * All inputs must be finite numbers; NaN, Infinity, and non-numbers are rejected.
 */

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(`${name} must be a number, got ${typeof value}`);
  }
  if (Number.isNaN(value)) {
    throw new Error(`${name} must not be NaN`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got ${value}`);
  }
}

export function add(a: number, b: number): number {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  return a + b;
}

export function subtract(a: number, b: number): number {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  return a - b;
}

export function multiply(a: number, b: number): number {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  return a * b;
}

export function divide(a: number, b: number): number {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}

export function sin(angleInRadians: number): number {
  assertFiniteNumber(angleInRadians, 'angleInRadians');
  return Math.sin(angleInRadians);
}
