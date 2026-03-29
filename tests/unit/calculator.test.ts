import { describe, it, expect } from "vitest";
import {
  add,
  subtract,
  multiply,
  divide,
  sinDeg,
} from "../../src/lib/calculator.js";

// ---------------------------------------------------------------------------
// US1: Basic Arithmetic Operations
// ---------------------------------------------------------------------------

describe("add", () => {
  it("returns 13 for add(8, 5)", () => {
    expect(add(8, 5)).toBe(13);
  });

  it("returns 0 for add(0, 0)", () => {
    expect(add(0, 0)).toBe(0);
  });

  it("returns 0 for add(-3, 3)", () => {
    expect(add(-3, 3)).toBe(0);
  });

  it("returns 0.3 for add(0.1, 0.2) — floating-point resolved by rounding", () => {
    expect(add(0.1, 0.2)).toBe(0.3);
  });

  it("returns 2.469 for add(1.2345, 1.2345)", () => {
    expect(add(1.2345, 1.2345)).toBe(2.469);
  });

  it("throws TypeError when first argument is null", () => {
    expect(() => add(null as unknown as number, 5)).toThrow(TypeError);
  });

  it("throws TypeError when first argument is undefined", () => {
    expect(() => add(undefined as unknown as number, 5)).toThrow(TypeError);
  });

  it("throws TypeError when first argument is NaN", () => {
    expect(() => add(NaN, 5)).toThrow(TypeError);
  });

  it("throws RangeError when first argument is Number.MAX_SAFE_INTEGER + 1", () => {
    expect(() => add(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow(RangeError);
  });

  it("throws RangeError when first argument is Infinity", () => {
    expect(() => add(Infinity, 5)).toThrow(RangeError);
  });
});

describe("subtract", () => {
  it("returns 6 for subtract(10, 4)", () => {
    expect(subtract(10, 4)).toBe(6);
  });

  it("returns -5 for subtract(0, 5)", () => {
    expect(subtract(0, 5)).toBe(-5);
  });

  it("returns 0 for subtract(5, 5)", () => {
    expect(subtract(5, 5)).toBe(0);
  });

  it("throws TypeError when first argument is null", () => {
    expect(() => subtract(null as unknown as number, 5)).toThrow(TypeError);
  });

  it("throws RangeError when first argument is Number.MAX_SAFE_INTEGER + 1", () => {
    expect(() => subtract(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow(RangeError);
  });
});

describe("multiply", () => {
  it("returns 42 for multiply(6, 7)", () => {
    expect(multiply(6, 7)).toBe(42);
  });

  it("returns 4.5 for multiply(3, 1.5)", () => {
    expect(multiply(3, 1.5)).toBe(4.5);
  });

  it("returns 0 for multiply(0, 999)", () => {
    expect(multiply(0, 999)).toBe(0);
  });

  it("returns -6 for multiply(-2, 3)", () => {
    expect(multiply(-2, 3)).toBe(-6);
  });

  it("throws TypeError when first argument is null", () => {
    expect(() => multiply(null as unknown as number, 3)).toThrow(TypeError);
  });

  it("throws RangeError when first argument is Infinity", () => {
    expect(() => multiply(Infinity, 3)).toThrow(RangeError);
  });
});

describe("divide", () => {
  it("returns 5 for divide(20, 4)", () => {
    expect(divide(20, 4)).toBe(5);
  });

  it("returns 0.3333 for divide(1, 3)", () => {
    expect(divide(1, 3)).toBe(0.3333);
  });

  it('throws Error("Cannot divide by zero") for divide(7, 0)', () => {
    expect(() => divide(7, 0)).toThrow(Error);
    expect(() => divide(7, 0)).toThrow("Cannot divide by zero");
  });

  it("returns -5 for divide(-10, 2)", () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it("throws TypeError when dividend is null", () => {
    expect(() => divide(null as unknown as number, 4)).toThrow(TypeError);
  });

  it("throws RangeError when dividend is Number.MAX_SAFE_INTEGER + 1", () => {
    expect(() => divide(Number.MAX_SAFE_INTEGER + 1, 4)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// US2: Sine Function
// ---------------------------------------------------------------------------

describe("sinDeg", () => {
  it("returns 0 for sinDeg(0)", () => {
    expect(sinDeg(0)).toBe(0);
  });

  it("returns 1 for sinDeg(90)", () => {
    expect(sinDeg(90)).toBe(1);
  });

  it("returns 0.5 for sinDeg(30)", () => {
    expect(sinDeg(30)).toBe(0.5);
  });

  it("returns -1 for sinDeg(-90)", () => {
    expect(sinDeg(-90)).toBe(-1);
  });

  it("returns 0 for sinDeg(180) — floating-point artifact resolved by rounding", () => {
    expect(sinDeg(180)).toBe(0);
  });

  it("returns 0.7071 for sinDeg(45)", () => {
    expect(sinDeg(45)).toBe(0.7071);
  });

  it("returns -1 for sinDeg(270)", () => {
    expect(sinDeg(270)).toBe(-1);
  });

  it("returns 0 for sinDeg(360)", () => {
    expect(sinDeg(360)).toBe(0);
  });

  it("throws TypeError when argument is a string", () => {
    expect(() => sinDeg("45" as unknown as number)).toThrow(TypeError);
  });

  it("throws TypeError when argument is null", () => {
    expect(() => sinDeg(null as unknown as number)).toThrow(TypeError);
  });

  it("throws RangeError when argument is Infinity", () => {
    expect(() => sinDeg(Infinity)).toThrow(RangeError);
  });

  it("throws RangeError when argument is Number.MAX_SAFE_INTEGER + 1", () => {
    expect(() => sinDeg(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
