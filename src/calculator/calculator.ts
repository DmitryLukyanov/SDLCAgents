/**
 * Simple calculator supporting +, -, *, / and sin (radians).
 */

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'sin';

export interface BinaryInput {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

export interface UnaryInput {
  operation: 'sin';
  a: number;
}

export type CalculatorInput = BinaryInput | UnaryInput;

export interface CalculatorResult {
  result: number;
}

export function calculate(input: CalculatorInput): CalculatorResult {
  switch (input.operation) {
    case 'add':
      return { result: input.a + input.b };
    case 'subtract':
      return { result: input.a - input.b };
    case 'multiply':
      return { result: input.a * input.b };
    case 'divide':
      if (input.b === 0) {
        throw new Error('Division by zero');
      }
      return { result: input.a / input.b };
    case 'sin':
      return { result: Math.sin(input.a) };
  }
}
