# Feature Specification: Simple Calculator

**Feature Branch**: `001-simple-calculator`  
**Created**: 2025-07-16  
**Status**: Draft  
**Jira**: TC-5  
**Input**: User description: "Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A developer or user invokes the calculator with two numbers and an arithmetic operator (+, -, *, /) and receives the correct numeric result.

**Why this priority**: Basic arithmetic is the core value of the calculator. Without it, the feature has no utility. This is the MVP slice.

**Independent Test**: Can be fully tested by calling each arithmetic operation with known inputs and verifying the output matches the expected result. Delivers a fully functional basic calculator.

**Acceptance Scenarios**:

1. **Given** two valid numbers and the `+` operator, **When** the calculator is invoked, **Then** it returns their sum.
2. **Given** two valid numbers and the `-` operator, **When** the calculator is invoked, **Then** it returns their difference.
3. **Given** two valid numbers and the `*` operator, **When** the calculator is invoked, **Then** it returns their product.
4. **Given** two valid numbers and the `/` operator with a non-zero divisor, **When** the calculator is invoked, **Then** it returns the correct quotient (including fractional results).

---

### User Story 2 - Division by Zero Protection (Priority: P2)

A user attempts to divide a number by zero. Instead of crashing or returning an undefined/infinite value silently, the calculator communicates a clear error.

**Why this priority**: Division by zero is a mathematically undefined operation. Producing a silent `Infinity` or `NaN` result would lead to confusing downstream behavior. Explicit error handling is critical for correctness and safety.

**Independent Test**: Can be fully tested by invoking the division operation with zero as the divisor and asserting that a descriptive error is returned or thrown.

**Acceptance Scenarios**:

1. **Given** any number as the dividend and `0` as the divisor, **When** division is requested, **Then** the calculator returns a clear error indicating division by zero is not allowed.
2. **Given** `0` divided by `0`, **When** division is requested, **Then** the calculator returns a clear error (not `NaN`).

---

### User Story 3 - Sine Trigonometric Function (Priority: P3)

A user invokes the sine function on a single numeric value (expressed in radians) and receives the correct sine result.

**Why this priority**: The `sin` function is an explicitly requested extension beyond basic arithmetic. It expands the calculator's utility for scientific/mathematical use cases. Only `sin` is in scope; no other trigonometric functions are included.

**Independent Test**: Can be fully tested by invoking `sin` with well-known radian values (e.g., `0`, `π/2`, `π`) and verifying the expected results (e.g., `0`, `1`, `~0`).

**Acceptance Scenarios**:

1. **Given** the angle `0` radians, **When** `sin` is invoked, **Then** the result is `0`.
2. **Given** the angle `π/2` radians (~1.5708), **When** `sin` is invoked, **Then** the result is `1` (within acceptable floating-point precision).
3. **Given** a negative radian value, **When** `sin` is invoked, **Then** the result is the correct negative sine value.
4. **Given** a very large radian value, **When** `sin` is invoked, **Then** the result is a valid number within the range [-1, 1].

---

### Edge Cases

- What happens when non-numeric input is provided to any operation? → The calculator must reject non-numeric inputs with a descriptive error.
- What happens when `Infinity` or `NaN` is passed as an operand? → The calculator must return a clear error or handle it predictably (not silently pass through).
- What happens when the result of an arithmetic operation overflows (e.g., very large numbers)? → Standard floating-point behavior applies; result may be `Infinity` — this is acceptable and does not require special handling beyond what the language provides natively.
- What happens when `sin` receives `Infinity` as input? → The result is `NaN`; the calculator should return a clear error rather than a silent `NaN`.
- Are cosine, tangent, or other trigonometric functions supported? → No. Only `sin` is in scope. Any call to unsupported operations must result in a clear "unsupported operation" error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition of two numbers.
- **FR-002**: The calculator MUST support subtraction of two numbers.
- **FR-003**: The calculator MUST support multiplication of two numbers.
- **FR-004**: The calculator MUST support division of two numbers.
- **FR-005**: The calculator MUST return a clear, descriptive error when division by zero is attempted — it MUST NOT return `Infinity` or `NaN` silently.
- **FR-006**: The calculator MUST support the `sin` function, accepting a single numeric argument expressed in radians.
- **FR-007**: The calculator MUST NOT support any trigonometric functions other than `sin` (no cosine, tangent, cotangent, etc.).
- **FR-008**: The calculator MUST reject non-numeric inputs and return a descriptive error identifying which argument is invalid.
- **FR-009**: The calculator MUST return a clear error when `sin` is called with a non-finite value (`Infinity` or `NaN`).
- **FR-010**: All calculator operations MUST be exposed as a callable module API, usable programmatically within the existing TypeScript project.
- **FR-011**: The calculator module MUST be covered by automated tests verifying each operation, including error cases.

### Key Entities

- **Calculator**: The module that exposes all supported operations. Accepts numeric inputs and returns numeric results or structured errors.
- **Operation**: A discrete computation — either a binary arithmetic operation (takes two operands) or a unary trigonometric function (takes one operand).
- **CalculationError**: A structured error type returned (or thrown) when an operation cannot be completed — includes a human-readable message identifying the cause (division by zero, invalid input, unsupported operation).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five supported operations (`+`, `-`, `*`, `/`, `sin`) return correct results for valid inputs — 100% of arithmetic and trigonometric test cases pass.
- **SC-002**: Division by zero produces a descriptive error in 100% of attempts — no `Infinity` or `NaN` is ever silently returned for this case.
- **SC-003**: Invalid or non-finite inputs to any operation produce a descriptive error in 100% of attempts.
- **SC-004**: Calling any unsupported operation returns a clear "unsupported operation" error rather than an unhandled exception or silent failure.
- **SC-005**: The `sin` function results match the mathematically correct value within standard floating-point precision (absolute error ≤ 1e-10 for well-known angles).
- **SC-006**: The calculator module is fully covered by automated tests — all requirement scenarios from FR-001 through FR-011 have at least one corresponding test case.

## Assumptions

- The calculator is implemented as a TypeScript module within the existing `src/` directory, consistent with the project's module structure.
- All numeric values are standard 64-bit floating-point numbers (IEEE 754 double precision); no arbitrary-precision arithmetic is required.
- Inputs to the calculator are assumed to arrive as TypeScript `number` values at the call site. Input parsing from strings (e.g., CLI or user input) is out of scope for this feature.
- Angle inputs to `sin` are always in **radians**. Degree-to-radian conversion is not provided by the calculator module.
- The module exports a clean, named API — not a class-based or stateful interface; each operation is a pure function.
- Error handling uses thrown exceptions (or returned error objects) rather than process exit codes, consistent with library usage patterns.
- The feature does not include a user interface (no CLI, no web UI); it is a pure programmatic module.
- `cos`, `tan`, `cot`, and all other trigonometric/logarithmic functions are explicitly out of scope for this version.
