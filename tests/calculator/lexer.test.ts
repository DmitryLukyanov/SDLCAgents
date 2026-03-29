// T005: Lexer unit tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer, TokenType } from '../../src/calculator/lexer.js';
import type { Token } from '../../src/calculator/lexer.js';

function lex(src: string): Token[] {
  return new Lexer(src).tokenise();
}

describe('Lexer', () => {
  describe('integer literals', () => {
    it('tokenises a single integer', () => {
      const tokens = lex('42');
      assert.equal(tokens.length, 2);
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[0]!.value, '42');
      assert.equal(tokens[1]!.type, TokenType.EOF);
    });

    it('tokenises zero', () => {
      const tokens = lex('0');
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[0]!.value, '0');
    });
  });

  describe('decimal literals', () => {
    it('tokenises a leading-dot decimal (.5)', () => {
      const tokens = lex('.5');
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[0]!.value, '.5');
    });

    it('tokenises a standard decimal (3.14)', () => {
      const tokens = lex('3.14');
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[0]!.value, '3.14');
    });

    it('tokenises a trailing-dot decimal (1.)', () => {
      const tokens = lex('1.');
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[0]!.value, '1.');
    });
  });

  describe('operator and paren characters', () => {
    it('tokenises +', () => {
      assert.equal(lex('+')[0]!.type, TokenType.PLUS);
    });

    it('tokenises -', () => {
      assert.equal(lex('-')[0]!.type, TokenType.MINUS);
    });

    it('tokenises *', () => {
      assert.equal(lex('*')[0]!.type, TokenType.STAR);
    });

    it('tokenises /', () => {
      assert.equal(lex('/')[0]!.type, TokenType.SLASH);
    });

    it('tokenises (', () => {
      assert.equal(lex('(')[0]!.type, TokenType.LPAREN);
    });

    it('tokenises )', () => {
      assert.equal(lex(')')[0]!.type, TokenType.RPAREN);
    });
  });

  describe('IDENT token', () => {
    it('tokenises sin as IDENT', () => {
      const tokens = lex('sin');
      assert.equal(tokens[0]!.type, TokenType.IDENT);
      assert.equal(tokens[0]!.value, 'sin');
    });

    it('tokenises underscore-prefixed identifier', () => {
      const tokens = lex('_foo');
      assert.equal(tokens[0]!.type, TokenType.IDENT);
      assert.equal(tokens[0]!.value, '_foo');
    });
  });

  describe('whitespace skipping', () => {
    it('skips spaces between tokens', () => {
      const tokens = lex('1 + 2');
      assert.equal(tokens.length, 4); // NUMBER, PLUS, NUMBER, EOF
      assert.equal(tokens[0]!.type, TokenType.NUMBER);
      assert.equal(tokens[1]!.type, TokenType.PLUS);
      assert.equal(tokens[2]!.type, TokenType.NUMBER);
    });

    it('skips tabs and newlines', () => {
      const tokens = lex('1\t+\n2');
      assert.equal(tokens.length, 4);
    });
  });

  describe('mixed expression tokenisation', () => {
    it('tokenises -5 + 3', () => {
      const tokens = lex('-5 + 3');
      assert.deepEqual(
        tokens.map(t => t.type),
        [TokenType.MINUS, TokenType.NUMBER, TokenType.PLUS, TokenType.NUMBER, TokenType.EOF]
      );
    });

    it('tokenises sin(90)', () => {
      const tokens = lex('sin(90)');
      assert.deepEqual(
        tokens.map(t => ({ type: t.type, value: t.value })),
        [
          { type: TokenType.IDENT, value: 'sin' },
          { type: TokenType.LPAREN, value: '(' },
          { type: TokenType.NUMBER, value: '90' },
          { type: TokenType.RPAREN, value: ')' },
          { type: TokenType.EOF, value: '' },
        ]
      );
    });

    it('tokenises (2+3)*4', () => {
      const tokens = lex('(2+3)*4');
      assert.deepEqual(
        tokens.map(t => t.type),
        [
          TokenType.LPAREN,
          TokenType.NUMBER,
          TokenType.PLUS,
          TokenType.NUMBER,
          TokenType.RPAREN,
          TokenType.STAR,
          TokenType.NUMBER,
          TokenType.EOF,
        ]
      );
    });
  });

  describe('unknown character error', () => {
    it('throws on @', () => {
      assert.throws(() => lex('@'), /Unexpected character '@'/);
    });

    it('throws on $', () => {
      assert.throws(() => lex('1 + $'), /Unexpected character '\$'/);
    });

    it('throws on #', () => {
      assert.throws(() => lex('#'), /Unexpected character '#'/);
    });
  });

  describe('EOF sentinel', () => {
    it('always appends EOF token', () => {
      const tokens = lex('');
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0]!.type, TokenType.EOF);
    });
  });
});
