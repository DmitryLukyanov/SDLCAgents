// ── Operation ─────────────────────────────────────────────────────────────────

export enum Operation {
  Add      = '+',
  Subtract = '-',
  Multiply = '*',
  Divide   = '/',
  Sin      = 'sin',
}

// ── ParsedExpression ──────────────────────────────────────────────────────────

export interface BinaryExpression {
  kind: 'binary';
  operator: Operation.Add | Operation.Subtract | Operation.Multiply | Operation.Divide;
  left: number;
  right: number;
}

export interface UnaryExpression {
  kind: 'unary';
  operator: Operation.Sin;
  operand: number; // angle in degrees; conversion to radians happens in calculator.ts
}

export type ParsedExpression = BinaryExpression | UnaryExpression;

// ── Parse result ──────────────────────────────────────────────────────────────

export interface ParseError {
  kind: 'parse-error';
  message: string;
}

export type ParseResult = ParsedExpression | ParseError;

// ── Calculator result ─────────────────────────────────────────────────────────

export interface SuccessResult {
  kind: 'success';
  value: number;
}

export interface ErrorResult {
  kind: 'error';
  message: string;
}

export type CalculatorResult = SuccessResult | ErrorResult;
