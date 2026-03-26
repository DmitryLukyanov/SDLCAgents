/** Supported calculator operations. */
export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide';

export class DivisionByZeroError extends Error {
  constructor() {
    super('Division by zero');
    this.name = 'DivisionByZeroError';
  }
}

/** Perform a binary arithmetic operation on two numbers. */
export function calculate(op: BinaryOperation, a: number, b: number): number {
  switch (op) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) throw new DivisionByZeroError();
      return a / b;
  }
}

/**
 * Compute sin of a value given in degrees.
 * Only sin is supported; cos, tan, cot are intentionally excluded.
 */
export function sinDeg(degrees: number): number {
  return Math.sin((degrees * Math.PI) / 180);
}

export function sinRad(radians: number): number {
  return Math.sin(radians);
}
