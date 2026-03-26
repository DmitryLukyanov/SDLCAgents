/**
 * CalculatorError is thrown by calculator functions when inputs are invalid
 * or an operation is mathematically undefined (e.g. division by zero).
 */
export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}

/**
 * Asserts that `value` is a finite number. Throws `CalculatorError` otherwise.
 * @param value - The value to check.
 * @param name  - The argument name shown in the error message.
 */
function assertFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new CalculatorError(
      `Argument '${name}' must be a finite number, got ${value}`,
    );
  }
}

/**
 * Returns the sum of `a` and `b`.
 * @throws {CalculatorError} If either argument is not a finite number.
 */
export function add(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a + b;
}

/**
 * Returns the difference of `a` minus `b`.
 * @throws {CalculatorError} If either argument is not a finite number.
 */
export function subtract(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a - b;
}

/**
 * Returns the product of `a` and `b`.
 * @throws {CalculatorError} If either argument is not a finite number.
 */
export function multiply(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  return a * b;
}

/**
 * Returns the quotient of `a` divided by `b`.
 * @throws {CalculatorError} If either argument is not a finite number.
 * @throws {CalculatorError} If `b` is zero.
 */
export function divide(a: number, b: number): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  if (b === 0) throw new CalculatorError('Division by zero is not allowed');
  return a / b;
}

/**
 * Returns the sine of `radians`.
 * @param radians - The angle in radians.
 * @throws {CalculatorError} If `radians` is not a finite number.
 */
export function sin(radians: number): number {
  assertFinite(radians, 'radians');
  return Math.sin(radians);
}
