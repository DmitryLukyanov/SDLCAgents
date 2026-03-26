# Feature Specification: Simple Calculator (TC-5)

**Feature Branch**: `TC-5-create-simple-calculator`
**Created**: 2026-03-26
**Status**: Approved
**Input**: User description: "Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A user wants to perform basic arithmetic calculations (+, -, *, /) on two numbers and receive the result.

**Why this priority**: Core calculator functionality. Without this, the feature provides no value.

**Independent Test**: Can be fully tested by calling `add(2, 3)`, `subtract(5, 2)`, `multiply(3, 4)`, `divide(10, 2)` and verifying numeric results.

**Acceptance Scenarios**:

1. **Given** two numbers `a` and `b`, **When** `add(a, b)` is called, **Then** returns `a + b`
2. **Given** two numbers `a` and `b`, **When** `subtract(a, b)` is called, **Then** returns `a - b`
3. **Given** two numbers `a` and `b`, **When** `multiply(a, b)` is called, **Then** returns `a * b`
4. **Given** two numbers `a` and `b` where `b ≠ 0`, **When** `divide(a, b)` is called, **Then** returns `a / b`
5. **Given** any number `a` and `b = 0`, **When** `divide(a, 0)` is called, **Then** throws an error indicating division by zero

---

### User Story 2 - Sine Function (Priority: P2)

A user wants to compute the sine of an angle (in radians) as an extension of the basic calculator.

**Why this priority**: Extends P1 with scientific capability. Requires basic operations to be in place first.

**Independent Test**: Can be fully tested by calling `sin(0)` → `0`, `sin(Math.PI / 2)` → `1`.

**Acceptance Scenarios**:

1. **Given** an angle in radians, **When** `sin(angle)` is called, **Then** returns the sine of the angle
2. **Given** `sin(0)`, **Then** returns `0`
3. **Given** `sin(Math.PI / 2)`, **Then** returns approximately `1`

---

### Edge Cases

- What happens when dividing by zero? → Throws a `CalculatorError` with a descriptive message.
- What happens with very large numbers? → Relies on JavaScript's native floating-point behaviour.
- What happens when `sin` receives `Infinity`? → Returns `NaN` (JavaScript native behaviour).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support addition of two numbers
- **FR-002**: System MUST support subtraction of two numbers
- **FR-003**: System MUST support multiplication of two numbers
- **FR-004**: System MUST support division of two numbers and throw a `CalculatorError` on division by zero
- **FR-005**: System MUST support the sine function (radians input), and MUST NOT include cosine, tangent, or cotangent

### Key Entities

- **CalculatorResult**: The numeric result of a calculation
- **CalculatorError**: An error thrown for invalid operations (e.g., division by zero)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five operations (add, subtract, multiply, divide, sin) are implemented and exported
- **SC-002**: Division by zero is gracefully handled with a typed error
- **SC-003**: All unit tests pass
- **SC-004**: TypeScript strict-mode type-checking passes without errors

## Assumptions

- Input values are JavaScript `number` (floating-point); no arbitrary precision required
- The sine function accepts radians (not degrees)
- No UI is required; the calculator is a library with an optional CLI entry point
- cosine, tangent, and cotangent are explicitly out of scope
