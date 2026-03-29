# Feature Specification: Simple Calculator

**Feature Branch**: `copilot-tc-5-create-simple-calculator-8e772bf5-25b9-44f7-b0c3-4c5f4c93b911`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: User description: "Create a calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Perform Basic Arithmetic (Priority: P1)

A user wants to perform basic arithmetic calculations — addition, subtraction, multiplication, and division — by entering two numbers and an operator, and instantly receiving the result.

**Why this priority**: Basic arithmetic is the core value of the calculator and must work on its own before any additional operations are added.

**Independent Test**: Can be fully tested by entering pairs of numbers with each of the four operators (+, -, *, /) and verifying correct numeric results are returned.

**Acceptance Scenarios**:

1. **Given** the calculator is ready to accept input, **When** the user enters `5 + 3`, **Then** the result `8` is displayed.
2. **Given** the calculator is ready to accept input, **When** the user enters `10 - 4`, **Then** the result `6` is displayed.
3. **Given** the calculator is ready to accept input, **When** the user enters `6 * 7`, **Then** the result `42` is displayed.
4. **Given** the calculator is ready to accept input, **When** the user enters `15 / 3`, **Then** the result `5` is displayed.
5. **Given** the calculator is ready to accept input, **When** the user enters `7 / 0`, **Then** a clear error message is displayed indicating division by zero is not allowed.

---

### User Story 2 - Compute Sine of an Angle (Priority: P2)

A user wants to calculate the sine of a numeric value (angle in degrees) by entering the value and requesting the sine operation, and receiving the computed sine result.

**Why this priority**: The sine function is an explicitly required extension to basic arithmetic. It adds mathematical utility on top of the core calculator, making the tool useful for users who need trigonometric calculations.

**Independent Test**: Can be fully tested by entering a known angle (e.g., 30°) and verifying the sine result matches the expected value (e.g., 0.5).

**Acceptance Scenarios**:

1. **Given** the calculator is ready to accept input, **When** the user requests `sin(0)`, **Then** the result `0` is displayed.
2. **Given** the calculator is ready to accept input, **When** the user requests `sin(30)`, **Then** the result `0.5` is displayed (input treated as degrees).
3. **Given** the calculator is ready to accept input, **When** the user requests `sin(90)`, **Then** the result `1` is displayed.
4. **Given** the calculator is ready to accept input, **When** the user requests `sin(-90)`, **Then** the result `-1` is displayed.
5. **Given** the calculator is ready to accept input, **When** the user requests `sin` for a non-numeric input, **Then** a clear error message is displayed indicating invalid input.

---

### User Story 3 - Handle Invalid Inputs Gracefully (Priority: P3)

A user accidentally enters an invalid expression (unknown operator, missing operand, or malformed input), and the calculator informs them what went wrong without crashing.

**Why this priority**: Robustness is important for usability. Users should always receive actionable feedback rather than an unexpected crash or silent failure.

**Independent Test**: Can be fully tested by submitting various malformed expressions and verifying a meaningful error message is displayed in each case.

**Acceptance Scenarios**:

1. **Given** the calculator is ready, **When** the user submits an empty or blank input, **Then** the calculator prompts the user to enter a valid expression.
2. **Given** the calculator is ready, **When** the user enters an unsupported operator (e.g., `%`, `^`, `cos`), **Then** a clear message states the operation is not supported.
3. **Given** the calculator is ready, **When** the user enters a partially complete expression (e.g., `5 +`), **Then** the calculator indicates the input is incomplete.

---

### Edge Cases

- What happens when the user divides by zero? → A clear, user-friendly error is displayed; no crash occurs.
- What happens when the user enters a very large number (e.g., beyond normal numeric range)? → The calculator either returns the result or displays an overflow notice.
- What happens when `sin` is given a very large angle? → The result is computed normally using standard trigonometric reduction (modular angle handling).
- What happens when the user enters a decimal number as input? → Decimal (floating-point) inputs are supported for all operations.
- What happens if the user requests `cos`, `tan`, or other trigonometric functions? → The calculator displays a message that only `sin` is supported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition of two numeric values.
- **FR-002**: The calculator MUST support subtraction of two numeric values.
- **FR-003**: The calculator MUST support multiplication of two numeric values.
- **FR-004**: The calculator MUST support division of two numeric values, with explicit handling of division by zero.
- **FR-005**: The calculator MUST support the `sin` trigonometric function, accepting a single numeric input (angle in degrees).
- **FR-006**: The calculator MUST NOT support any other trigonometric functions (cos, tan, cot, or similar).
- **FR-007**: The calculator MUST display a clear, human-readable error message for invalid, incomplete, or unsupported inputs.
- **FR-008**: The calculator MUST accept decimal (floating-point) numbers as operands for all supported operations.
- **FR-009**: The calculator MUST display results with sufficient decimal precision to be meaningful to the user (at least 4 decimal places for non-integer results).

### Key Entities

- **Expression**: A user-provided calculation request, consisting of an operation and one or two numeric operands (e.g., `5 + 3`, `sin(30)`).
- **Result**: The numeric output produced by evaluating a valid Expression, or an error message produced by evaluating an invalid one.
- **Operation**: One of the five supported operations: addition (`+`), subtraction (`-`), multiplication (`*`), division (`/`), or sine (`sin`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four basic arithmetic operations return correct results for 100% of valid numeric inputs, including integers and decimals.
- **SC-002**: The `sin` function returns results accurate to at least 4 decimal places for any valid numeric angle input.
- **SC-003**: Division by zero is handled gracefully in 100% of cases — no crash, always returns an error message.
- **SC-004**: Unsupported operations (including cos, tan, and other trigonometric functions) are rejected with an informative message in 100% of cases.
- **SC-005**: Users receive a result or a meaningful error message within 1 second of submitting any input.
- **SC-006**: 100% of invalid or malformed inputs produce a descriptive error message rather than a crash or silent failure.

## Assumptions

- The calculator is a single-user tool; no account management, history persistence, or sharing functionality is required.
- Angle input for `sin` is interpreted in degrees (not radians), which is the most common expectation for end users.
- The calculator supports standard floating-point numeric precision; extremely high-precision (arbitrary precision) arithmetic is out of scope.
- Chained expressions (e.g., `1 + 2 + 3`) and expression trees are out of scope; the calculator handles one operation at a time.
- The form factor (command-line, web UI, library API) is not prescribed by this spec and will be determined during planning.
- No history, memory, or state persistence between calculations is required.
