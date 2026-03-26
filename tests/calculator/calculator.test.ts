import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, calculate } from '../../src/calculator/calculator.js';

// ---------------------------------------------------------------------------
// T005 / T010 / T014 — Unit tests for parseArgs() and calculate()
// ---------------------------------------------------------------------------

describe('calculate() — arithmetic operations (T005/T008)', () => {
  // add
  it('add: integer sum', () => {
    const r = calculate('add', [3, 5]);
    assert.ok(r.ok);
    assert.equal(r.value, 8);
  });

  it('add: decimal sum', () => {
    const r = calculate('add', [1.1, 2.2]);
    assert.ok(r.ok);
    assert.ok(Math.abs(r.value - 3.3) < 1e-10);
  });

  it('add: negative operands', () => {
    const r = calculate('add', [-4, -6]);
    assert.ok(r.ok);
    assert.equal(r.value, -10);
  });

  // subtract
  it('subtract: positive difference', () => {
    const r = calculate('subtract', [10, 3]);
    assert.ok(r.ok);
    assert.equal(r.value, 7);
  });

  it('subtract: result is zero', () => {
    const r = calculate('subtract', [5, 5]);
    assert.ok(r.ok);
    assert.equal(r.value, 0);
  });

  it('subtract: negative result', () => {
    const r = calculate('subtract', [3, 10]);
    assert.ok(r.ok);
    assert.equal(r.value, -7);
  });

  // multiply
  it('multiply: integer product', () => {
    const r = calculate('multiply', [6, 7]);
    assert.ok(r.ok);
    assert.equal(r.value, 42);
  });

  it('multiply: decimal product', () => {
    const r = calculate('multiply', [2.5, 4]);
    assert.ok(r.ok);
    assert.equal(r.value, 10);
  });

  it('multiply: multiply-by-zero', () => {
    const r = calculate('multiply', [99, 0]);
    assert.ok(r.ok);
    assert.equal(r.value, 0);
  });

  // divide
  it('divide: exact quotient', () => {
    const r = calculate('divide', [10, 2]);
    assert.ok(r.ok);
    assert.equal(r.value, 5);
  });

  it('divide: decimal quotient', () => {
    const r = calculate('divide', [10, 4]);
    assert.ok(r.ok);
    assert.equal(r.value, 2.5);
  });

  it('divide: division by zero returns error (T020)', () => {
    const r = calculate('divide', [5, 0]);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Division by zero');
  });
});

describe('calculate() — sine operation (T010/T013)', () => {
  it('sin(0) === 0', () => {
    const r = calculate('sin', [0]);
    assert.ok(r.ok);
    assert.equal(r.value, 0);
  });

  it('sin(π/2) ≈ 1', () => {
    const r = calculate('sin', [Math.PI / 2]);
    assert.ok(r.ok);
    assert.ok(Math.abs(r.value - 1) < 1e-10);
  });

  it('sin(-π/2) ≈ -1', () => {
    const r = calculate('sin', [-Math.PI / 2]);
    assert.ok(r.ok);
    assert.ok(Math.abs(r.value - -1) < 1e-10);
  });
});

describe('parseArgs() — happy paths (T005/T010)', () => {
  it('parseArgs add 3 5 → 8', () => {
    const r = parseArgs(['add', '3', '5']);
    assert.ok(r.ok);
    assert.equal(r.value, 8);
  });

  it('parseArgs subtract 10 3 → 7', () => {
    const r = parseArgs(['subtract', '10', '3']);
    assert.ok(r.ok);
    assert.equal(r.value, 7);
  });

  it('parseArgs multiply 2.5 4 → 10', () => {
    const r = parseArgs(['multiply', '2.5', '4']);
    assert.ok(r.ok);
    assert.equal(r.value, 10);
  });

  it('parseArgs divide 10 4 → 2.5', () => {
    const r = parseArgs(['divide', '10', '4']);
    assert.ok(r.ok);
    assert.equal(r.value, 2.5);
  });

  it('parseArgs sin 0 → 0', () => {
    const r = parseArgs(['sin', '0']);
    assert.ok(r.ok);
    assert.equal(r.value, 0);
  });

  it('parseArgs sin 1.5707963267948966 → ≈ 1', () => {
    const r = parseArgs(['sin', '1.5707963267948966']);
    assert.ok(r.ok);
    assert.ok(Math.abs(r.value - 1) < 1e-10);
  });
});

describe('parseArgs() — error paths (T014)', () => {
  it('no args → usage message', () => {
    const r = parseArgs([]);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Usage: calc <operation> [operands...]');
  });

  it('unknown op "cos" → unsupported message', () => {
    const r = parseArgs(['cos', '1']);
    assert.ok(!r.ok);
    assert.equal(
      r.error,
      'Unsupported operation: "cos". Supported: add, subtract, multiply, divide, sin',
    );
  });

  it('unknown op "tan" → unsupported message', () => {
    const r = parseArgs(['tan', '1']);
    assert.ok(!r.ok);
    assert.equal(
      r.error,
      'Unsupported operation: "tan". Supported: add, subtract, multiply, divide, sin',
    );
  });

  it('unknown op "foo" → unsupported message', () => {
    const r = parseArgs(['foo']);
    assert.ok(!r.ok);
    assert.equal(
      r.error,
      'Unsupported operation: "foo". Supported: add, subtract, multiply, divide, sin',
    );
  });

  it('add with 1 operand → wrong count error', () => {
    const r = parseArgs(['add', '3']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"add" requires 2 numeric operands');
  });

  it('add with 3 operands → wrong count error', () => {
    const r = parseArgs(['add', '1', '2', '3']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"add" requires 2 numeric operands');
  });

  it('subtract with 1 operand → wrong count error', () => {
    const r = parseArgs(['subtract', '5']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"subtract" requires 2 numeric operands');
  });

  it('multiply with 0 operands → wrong count error', () => {
    const r = parseArgs(['multiply']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"multiply" requires 2 numeric operands');
  });

  it('divide with 1 operand → wrong count error', () => {
    const r = parseArgs(['divide', '5']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"divide" requires 2 numeric operands');
  });

  it('sin with 0 operands → wrong count error', () => {
    const r = parseArgs(['sin']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"sin" requires 1 numeric operand');
  });

  it('sin with 2 operands → wrong count error', () => {
    const r = parseArgs(['sin', '1', '2']);
    assert.ok(!r.ok);
    assert.equal(r.error, '"sin" requires 1 numeric operand');
  });

  it('non-numeric first operand → invalid input error', () => {
    const r = parseArgs(['add', 'abc', '3']);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Invalid input: "abc" is not a number');
  });

  it('non-numeric second operand → invalid input error', () => {
    const r = parseArgs(['add', '3', 'xyz']);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Invalid input: "xyz" is not a number');
  });

  it('empty string operand → invalid input error', () => {
    const r = parseArgs(['add', '', '3']);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Invalid input: "" is not a number');
  });

  it('divide 5 0 → division by zero error', () => {
    const r = parseArgs(['divide', '5', '0']);
    assert.ok(!r.ok);
    assert.equal(r.error, 'Division by zero');
  });
});
