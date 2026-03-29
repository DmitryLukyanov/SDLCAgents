/**
 * Formats a number for REPL display.
 *
 * Rules (FR-009):
 * - Infinity, -Infinity, or NaN → "Result is out of numeric range."
 * - Finite non-NaN  → parseFloat(value.toPrecision(10)).toString()
 *   Strips trailing zeros and the decimal point for integers automatically.
 */
export function formatNumber(value: number): string {
  if (!isFinite(value) || isNaN(value)) {
    return 'Result is out of numeric range.';
  }

  return parseFloat(value.toPrecision(10)).toString();
}
