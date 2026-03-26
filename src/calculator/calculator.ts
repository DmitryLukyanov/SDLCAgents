/**
 * Simple calculator supporting basic arithmetic and sine.
 *
 * Supported operations: add, subtract, multiply, divide, sin.
 * Note: only sin is provided from trigonometry — cos, tan, cot are out of scope.
 */
export class Calculator {
  static add(a: number, b: number): number {
    return a + b;
  }

  static subtract(a: number, b: number): number {
    return a - b;
  }

  static multiply(a: number, b: number): number {
    return a * b;
  }

  /** @throws {Error} when divisor is zero */
  static divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }

  /** Sine of x (x in radians). */
  static sin(x: number): number {
    return Math.sin(x);
  }
}
