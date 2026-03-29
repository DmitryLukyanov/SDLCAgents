/**
 * Trigonometric operations for the simple calculator.
 * All functions accept angles in radians and perform input validation.
 */

export function sin(a: number): number {
  if (typeof a !== 'number') {
    throw new TypeError('Argument must be a number');
  }
  return Math.sin(a);
}
