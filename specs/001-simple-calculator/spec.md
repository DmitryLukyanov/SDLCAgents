# Feature Specification: Simple Calculator (TC-5)

**Feature Branch**: `001-simple-calculator`  
**Jira Issue**: TC-5  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Basic Arithmetic Operations (Priority: P1)

A developer integrating the calculator into an application needs to perform the four fundamental arithmetic operations: addition, subtraction, multiplication, and division. They call the calculator with two numeric operands and an operator, and receive an exact numeric result.

**Why this priority**: Basic arithmetic is the foundational capability of the calculator. Nothing else is viable without it working correctly.

**Independent Test**: Can be fully tested by calling each of the four operations with known inputs and verifying the outputs match mathematically correct results. Delivers a working arithmetic calculator.

**Acceptance Scenarios**:

1. **Given** two numbers `a` and `b`, **When** the addition operation is requested, **Then** the result equals `a + b` with full numeric precision.
2. **Given** two numbers `a` and `b`, **When** the subtraction operation is requested, **Then** the result equals `a - b`.
3. **Given** two numbers `a` and `b`, **When** the multiplication operation is requested, **Then** the result equals `a * b`.
4. **Given** two non-zero numbers `a` and `b`, **When** the division operation is requested, **Then** the result equals `a / b`.
5. **Given** a numerator `a` and divisor `0`, **When** the division operation is requested, **Then** the calculator signals a division-by-zero error clearly and does not return a numeric value silently.
6. **Given** negative numbers as operands, **When** any arithmetic operation is requested, **Then** the result correctly handles negative values.

---

### User Story 2 — Sine Function (Priority: P2)

A developer needs to compute the sine of an angle to support scientific or engineering calculations within their application. They call the calculator with a single numeric input and receive the sine of that value.

**Why this priority**: The sine function is an explicitly requested extension beyond basic arithmetic. It delivers the scientific calculation capability described in TC-5.

**Independent Test**: Can be fully tested by calling the sine operation with known angle values (e.g., 0, π/2, π) and verifying results match expected sine values within acceptable numeric precision.

**Acceptance Scenarios**:

1. **Given** an angle of `0`, **When** the sine operation is requested, **Then** the result is `0`.
2. **Given** an angle of `π/2` (90°), **When** the sine operation is requested, **Then** the result is `1` (within standard floating-point precision).
3. **Given** an angle of `π` (180°), **When** the sine operation is requested, **Then** the result is `0` (within standard floating-point precision).
4. **Given** a negative angle, **When** the sine operation is requested, **Then** the result correctly reflects the sine of the negative angle.
5. **Given** a very large angle value, **When** the sine operation is requested, **Then** the result stays within the valid range `[-1, 1]`.

---

### User Story 3 — Error Handling and Invalid Input (Priority: P3)

A developer passes unexpected or invalid inputs to the calculator — such as non-numeric values or unsupported operations — and expects the calculator to communicate errors clearly without crashing the host application.

**Why this priority**: Robust error handling protects integrating applications from unexpected failures and makes the module safe to embed in larger systems.

**Independent Test**: Can be fully tested by supplying invalid inputs and verifying that descriptive errors are returned or raised, and that no silent incorrect results are produced.

**Acceptance Scenarios**:

1. **Given** an unsupported operation name is requested, **When** the calculator is called, **Then** it returns or raises a clear error identifying the unsupported operation.
2. **Given** a non-numeric value is passed as an operand, **When** any operation is requested, **Then** the calculator returns or raises a descriptive error rather than producing `NaN` or `undefined` silently.
3. **Given** the sine function is called with a missing argument, **When** the operation is requested, **Then** the calculator returns or raises a descriptive error.

---

### Edge Cases

- What happens when an operand is `Infinity` or `-Infinity`? → The calculator should propagate standard numeric infinity rules and not throw unexpectedly.
- What happens when both operands are `0` in division? → A division-by-zero error must be raised.
- What happens with floating-point precision edge cases (e.g., `0.1 + 0.2`)? → The calculator returns the mathematically expected floating-point result; no custom rounding is applied unless specified.
- What happens when `sin` receives `Infinity`? → The result is `NaN` following standard numeric conventions; no crash occurs.
- Is the sine function angle input in radians or degrees? → Radians (standard mathematical convention; see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition of two numeric values.
- **FR-002**: The calculator MUST support subtraction of two numeric values.
- **FR-003**: The calculator MUST support multiplication of two numeric values.
- **FR-004**: The calculator MUST support division of two numeric values.
- **FR-005**: The calculator MUST return a clear, explicit error when division by zero is attempted; it MUST NOT return `Infinity` silently as the result.
- **FR-006**: The calculator MUST support computing the sine of a single numeric value (angle in radians).
- **FR-007**: The calculator MUST NOT expose cosine, tangent, cotangent, or any other trigonometric functions beyond sine.
- **FR-008**: The calculator MUST return a clear, descriptive error when an unsupported operation is requested.
- **FR-009**: The calculator MUST return a clear, descriptive error when required operands are missing or non-numeric.
- **FR-010**: All operations MUST return a numeric result or a structured error — never silently return `undefined`, `null`, or `NaN` without an accompanying error signal.

### Key Entities

- **Operation**: A calculation request consisting of an operator identifier (`add`, `subtract`, `multiply`, `divide`, `sin`) and one or two numeric operands, returning a numeric result or an error.
- **Operand**: A numeric input value supplied to an operation. Binary operations (`+`, `-`, `*`, `/`) require two operands; the sine function requires exactly one.
- **Result**: The numeric output of a successfully evaluated operation, expressed as a standard floating-point number.
- **Error**: A structured signal returned when the operation cannot be completed (e.g., division by zero, unsupported operation, invalid input). Includes a human-readable message identifying the cause.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four arithmetic operations (`+`, `-`, `*`, `/`) produce mathematically correct results for 100% of valid numeric inputs, verified by automated tests covering positive, negative, zero, and decimal operands.
- **SC-002**: The sine operation produces results that match reference values to within standard IEEE 754 double-precision floating-point tolerance for all tested angles.
- **SC-003**: Division by zero is rejected with an explicit error in 100% of cases — no silent `Infinity` or `NaN` result is ever returned for this case.
- **SC-004**: Requests for unsupported operations (cosine, tangent, cotangent, or any unknown operator) are rejected with a descriptive error in 100% of cases.
- **SC-005**: Invalid or missing inputs (non-numeric values, missing operands) are rejected with a descriptive error in 100% of cases — no silent `undefined` or `NaN` is produced.
- **SC-006**: Each operation completes in under 10 milliseconds for any valid input under normal system conditions.

## Assumptions

- **Angle unit**: The sine function accepts angles in **radians**, following standard mathematical and scientific convention. If degrees are required, that is a separate scope item not covered by TC-5.
- **Numeric type**: All operands and results are standard floating-point numbers. Integer-only arithmetic or arbitrary-precision arithmetic is out of scope.
- **Binary-only arithmetic**: The four basic operations (`+`, `-`, `*`, `/`) each accept exactly two operands. Chained or multi-operand expressions (e.g., `1 + 2 + 3` in one call) are out of scope.
- **No state/history**: The calculator is stateless — it does not store previous results or support memory functions.
- **No expression parsing**: The calculator does not parse mathematical expression strings (e.g., `"3 + 4 * sin(0.5)"`). Each operation is invoked programmatically with explicit inputs.
- **No UI**: The feature delivers a reusable software module; no graphical or command-line user interface is in scope for TC-5.
- **Trigonometric scope is fixed**: Only `sin` is included. Adding `cos`, `tan`, `cot`, or any other function requires a new Jira issue.
- **Error signalling**: Errors are communicated via the module's return value or a thrown error object — the exact mechanism is determined during implementation planning.
