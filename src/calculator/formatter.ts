// T004: Formatter — number → 10-significant-digit string

export function format(n: number): string {
  if (!isFinite(n)) {
    return String(n);
  }
  return parseFloat(n.toPrecision(10)).toString();
}
