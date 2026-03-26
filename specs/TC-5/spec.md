# Feature Specification: Simple Calculator (TC-5)

**Feature Branch**: `copilot/tc-5-create-simple-calculator`  
**Created**: 2026-03-26  
**Status**: Approved  
**Input**: Jira TC-5 — "Create simple calculator"

## Global directive (all agents)

Do not assume, ask

## User Scenarios & Testing

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A developer or end-user invokes the calculator to perform standard arithmetic: addition, subtraction, multiplication, and division on two numbers and receives a numeric result.

**Why this priority**: Core value of a calculator; all other operations build on this foundation.

**Independent Test**: Can be fully tested by calling `add(2, 3)`, `subtract(5, 2)`, `multiply(3, 4)`, `divide(10, 2)` and verifying the correct numeric results.

**Acceptance Scenarios**:

1. **Given** two numbers, **When** `add(a, b)` is called, **Then** the sum `a + b` is returned.
2. **Given** two numbers, **When** `subtract(a, b)` is called, **Then** the difference `a - b` is returned.
3. **Given** two numbers, **When** `multiply(a, b)` is called, **Then** the product `a * b` is returned.
4. **Given** a numerator and a non-zero denominator, **When** `divide(a, b)` is called, **Then** the quotient `a / b` is returned.
5. **Given** any number and zero as denominator, **When** `divide(a, 0)` is called, **Then** an error is thrown indicating division by zero.

---

### User Story 2 - Sine Function (Priority: P2)

A developer or end-user invokes `sin(x)` on a number (in radians) and receives the sine value.  
Only `sin` is supported — `cos`, `tan`, `cot`, and other trigonometric functions are **explicitly out of scope**.

**Why this priority**: Extends the calculator with the one required trigonometric function per the Jira specification.

**Independent Test**: Can be fully tested by calling `sin(0)` → 0, `sin(Math.PI / 2)` → 1, `sin(Math.PI)` ≈ 0.

**Acceptance Scenarios**:

1. **Given** a number in radians, **When** `sin(x)` is called, **Then** the sine of `x` is returned.
2. **Given** `sin(0)`, **Then** the result is `0`.
3. **Given** `sin(Math.PI / 2)`, **Then** the result is approximately `1`.

---

### Edge Cases

- Division by zero must throw an explicit error (not return `Infinity` or `NaN`).
- All inputs must be finite numbers; non-finite inputs (NaN, Infinity) must throw an error.
- `sin` accepts any finite number in radians.

## Requirements

### Functional Requirements

- **FR-001**: The calculator MUST support addition of two numbers via `add(a, b)`.
- **FR-002**: The calculator MUST support subtraction of two numbers via `subtract(a, b)`.
- **FR-003**: The calculator MUST support multiplication of two numbers via `multiply(a, b)`.
- **FR-004**: The calculator MUST support division of two numbers via `divide(a, b)`.
- **FR-005**: `divide(a, 0)` MUST throw an error — it MUST NOT return `Infinity` or `NaN`.
- **FR-006**: The calculator MUST support sine via `sin(x)` (radians input).
- **FR-007**: `cos`, `tan`, `cot`, and any other trigonometric functions are explicitly OUT OF SCOPE.
- **FR-008**: All functions MUST validate that inputs are finite numbers and throw on invalid input.

### Key Entities

- **Calculator module**: A pure TypeScript module exporting individual functions; no class or state required.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four arithmetic operations return correct IEEE 754 results for valid finite inputs.
- **SC-002**: Division by zero throws a descriptive `Error` instance.
- **SC-003**: `sin(x)` returns the same result as `Math.sin(x)` for any finite `x`.
- **SC-004**: TypeScript strict-mode type checking passes with no errors.

## Assumptions

- The calculator is a TypeScript library module (not a CLI or web service).
- Inputs are JavaScript `number` (IEEE 754 double-precision float).
- The module is consumed programmatically; no UI layer is in scope.
- Angle input to `sin` is in radians (matching the JavaScript `Math.sin` convention).
