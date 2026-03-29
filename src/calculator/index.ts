// Library entry point — re-exports the public API surface.
// cli.ts is intentionally excluded: consumers must not pull in node:readline.

export { calculate, evaluate, sinDegrees } from './calculator.js';
export { formatNumber } from './formatter.js';
export { Operation } from './types.js';
export type {
  CalculatorResult,
  SuccessResult,
  ErrorResult,
  ParsedExpression,
  BinaryExpression,
  UnaryExpression,
  ParseError,
  ParseResult,
} from './types.js';
