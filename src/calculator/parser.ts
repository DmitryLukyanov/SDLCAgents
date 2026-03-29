// T008 + T012: Parser — Token[] → number (arithmetic + sin)

import { Lexer } from './lexer.js';
import type { Token } from './lexer.js';
import { TokenType } from './lexer.js';

class Parser {
  private readonly tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private consume(): Token {
    const tok = this.tokens[this.pos]!;
    this.pos++;
    return tok;
  }

  // expression ::= term ( ( '+' | '-' ) term )*
  private expression(): number {
    let left = this.term();
    while (this.peek().type === TokenType.PLUS || this.peek().type === TokenType.MINUS) {
      const op = this.consume();
      const right = this.term();
      if (op.type === TokenType.PLUS) {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    return left;
  }

  // term ::= unary ( ( '*' | '/' ) unary )*
  private term(): number {
    let left = this.unary();
    while (this.peek().type === TokenType.STAR || this.peek().type === TokenType.SLASH) {
      const op = this.consume();
      const right = this.unary();
      if (op.type === TokenType.STAR) {
        left = left * right;
      } else {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      }
    }
    return left;
  }

  // unary ::= '-' unary | primary
  private unary(): number {
    if (this.peek().type === TokenType.MINUS) {
      this.consume();
      return -this.unary();
    }
    return this.primary();
  }

  // primary ::= NUMBER | 'sin' '(' expression ')' | '(' expression ')'
  private primary(): number {
    const tok = this.peek();

    if (tok.type === TokenType.NUMBER) {
      this.consume();
      return parseFloat(tok.value);
    }

    if (tok.type === TokenType.IDENT) {
      this.consume(); // consume the identifier
      if (tok.value !== 'sin') {
        throw new Error(`Unknown function '${tok.value}'`);
      }
      // sin '(' expression ')'
      if (this.peek().type !== TokenType.LPAREN) {
        throw new Error("Expected '('");
      }
      this.consume(); // consume '('
      const arg = this.expression();
      if (this.peek().type !== TokenType.RPAREN) {
        throw new Error("Expected ')'");
      }
      this.consume(); // consume ')'
      return Math.sin(arg * Math.PI / 180);
    }

    if (tok.type === TokenType.LPAREN) {
      this.consume(); // consume '('
      const val = this.expression();
      if (this.peek().type !== TokenType.RPAREN) {
        throw new Error("Expected ')'");
      }
      this.consume(); // consume ')'
      return val;
    }

    throw new Error(`Unexpected token '${tok.value}'`);
  }

  parse(): number {
    const result = this.expression();
    const next = this.peek();
    if (next.type !== TokenType.EOF) {
      throw new Error(`Unexpected token '${next.value}'`);
    }
    return result;
  }
}

export function evaluate(source: string): number {
  const tokens = new Lexer(source).tokenise();
  return new Parser(tokens).parse();
}
