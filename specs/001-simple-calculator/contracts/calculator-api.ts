/**
 * Public API contract for the Simple Calculator library (TC-5).
 *
 * File: src/lib/calculator.ts
 * Module: ESM named exports — no default export.
 *
 * All functions are pure (no I/O, no state).
 * Validation is applied to every argument before computation.
 * Results are rounded to 4 decimal places for non-integers;
 * integer results are returned as whole numbers (no trailing zeros).
 */

// ---------------------------------------------------------------------------
// Arithmetic operations
// ---------------------------------------------------------------------------

/**
 * Returns the sum of two numbers.
 *
 * @param a - First operand (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Second operand (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a + b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example add(8, 5)   // → 13
 * @example add(1, 3)   // → 4
 * @example add(0.1, 0.2) // → 0.3
 */
export declare function add(a: number, b: number): number;

/**
 * Returns the difference of two numbers.
 *
 * @param a - Minuend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Subtrahend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a - b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example subtract(10, 4) // → 6
 * @example subtract(0, 5)  // → -5
 */
export declare function subtract(a: number, b: number): number;

/**
 * Returns the product of two numbers.
 *
 * @param a - First factor (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Second factor (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns `a * b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example multiply(6, 7)   // → 42
 * @example multiply(3, 1.5) // → 4.5
 */
export declare function multiply(a: number, b: number): number;

/**
 * Returns the quotient of two numbers.
 *
 * @param a - Dividend (must be a finite number within ±MAX_SAFE_INTEGER)
 * @param b - Divisor  (must be a finite number within ±MAX_SAFE_INTEGER, and non-zero)
 * @returns `a / b`, rounded to 4 dp if non-integer
 * @throws {TypeError}  If either argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If either argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 * @throws {Error}      `"Cannot divide by zero"` if `b === 0`
 *
 * @example divide(20, 4) // → 5
 * @example divide(1, 3)  // → 0.3333
 * @example divide(7, 0)  // throws Error("Cannot divide by zero")
 */
export declare function divide(a: number, b: number): number;

// ---------------------------------------------------------------------------
// Trigonometric operations
// ---------------------------------------------------------------------------

/**
 * Returns the sine of an angle given in degrees.
 *
 * Conversion: `Math.sin(x * Math.PI / 180)`
 *
 * @param x - Angle in degrees (must be a finite number within ±MAX_SAFE_INTEGER)
 * @returns Sine of the angle, rounded to 4 dp if non-integer
 * @throws {TypeError}  If the argument is non-numeric, NaN, null, or undefined
 * @throws {RangeError} If the argument is non-finite or exceeds ±Number.MAX_SAFE_INTEGER
 *
 * @example sinDeg(0)   // → 0
 * @example sinDeg(90)  // → 1
 * @example sinDeg(30)  // → 0.5
 * @example sinDeg(-90) // → -1
 * @example sinDeg(180) // → 0  (floating-point artifact resolved by rounding)
 *
 * @note ONLY sine is supported. cos, tan, cot, and other trig functions
 *       are explicitly out of scope (FR-006).
 */
export declare function sinDeg(x: number): number;

// ---------------------------------------------------------------------------
// Error contract summary
// ---------------------------------------------------------------------------
//
// | Error class  | Message                                                      | Trigger                                       |
// |--------------|--------------------------------------------------------------|-----------------------------------------------|
// | TypeError    | "Invalid input: expected a finite number for '<arg>', got <type>" | non-number / NaN / null / undefined arg  |
// | RangeError   | "Input exceeds supported numeric range"                      | Infinity, -Infinity, or |x| > MAX_SAFE_INTEGER |
// | Error        | "Cannot divide by zero"                                      | divide(a, 0) after validation passes          |
