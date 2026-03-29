// T003: Lexer — string → Token[]

export enum TokenType {
  NUMBER,
  IDENT,
  PLUS,
  MINUS,
  STAR,
  SLASH,
  LPAREN,
  RPAREN,
  EOF,
}

export type Token = {
  type: TokenType;
  value: string;
};

export class Lexer {
  private readonly src: string;
  private pos: number = 0;

  constructor(src: string) {
    this.src = src;
  }

  tokenise(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;

      // 1. Whitespace — skip
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
        continue;
      }

      // 2. NUMBER — /\d+(\.\d*)?|\.\d+/
      if (ch >= '0' && ch <= '9') {
        const start = this.pos;
        while (this.pos < this.src.length && this.src[this.pos]! >= '0' && this.src[this.pos]! <= '9') {
          this.pos++;
        }
        if (this.pos < this.src.length && this.src[this.pos] === '.') {
          this.pos++;
          while (this.pos < this.src.length && this.src[this.pos]! >= '0' && this.src[this.pos]! <= '9') {
            this.pos++;
          }
        }
        tokens.push({ type: TokenType.NUMBER, value: this.src.slice(start, this.pos) });
        continue;
      }

      // Leading-dot decimal: .5, .123
      if (ch === '.' && this.pos + 1 < this.src.length && this.src[this.pos + 1]! >= '0' && this.src[this.pos + 1]! <= '9') {
        const start = this.pos;
        this.pos++; // consume '.'
        while (this.pos < this.src.length && this.src[this.pos]! >= '0' && this.src[this.pos]! <= '9') {
          this.pos++;
        }
        tokens.push({ type: TokenType.NUMBER, value: this.src.slice(start, this.pos) });
        continue;
      }

      // 3. IDENT — /[a-zA-Z_][a-zA-Z0-9_]*/
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
        const start = this.pos;
        while (
          this.pos < this.src.length &&
          ((this.src[this.pos]! >= 'a' && this.src[this.pos]! <= 'z') ||
            (this.src[this.pos]! >= 'A' && this.src[this.pos]! <= 'Z') ||
            (this.src[this.pos]! >= '0' && this.src[this.pos]! <= '9') ||
            this.src[this.pos] === '_')
        ) {
          this.pos++;
        }
        tokens.push({ type: TokenType.IDENT, value: this.src.slice(start, this.pos) });
        continue;
      }

      // 4. Single-character operators
      switch (ch) {
        case '+': tokens.push({ type: TokenType.PLUS, value: ch }); this.pos++; continue;
        case '-': tokens.push({ type: TokenType.MINUS, value: ch }); this.pos++; continue;
        case '*': tokens.push({ type: TokenType.STAR, value: ch }); this.pos++; continue;
        case '/': tokens.push({ type: TokenType.SLASH, value: ch }); this.pos++; continue;
        case '(': tokens.push({ type: TokenType.LPAREN, value: ch }); this.pos++; continue;
        case ')': tokens.push({ type: TokenType.RPAREN, value: ch }); this.pos++; continue;
      }

      // 5. Unknown character
      throw new Error(`Unexpected character '${ch}'`);
    }

    tokens.push({ type: TokenType.EOF, value: '' });
    return tokens;
  }
}
