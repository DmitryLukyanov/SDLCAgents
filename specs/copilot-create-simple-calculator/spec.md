# Feature Specification: Simple Calculator

**Feature Branch**: `copilot-create-simple-calculator`  
**Created**: 2025-07-18  
**Status**: Draft  
**Input**: User description: "Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)"

## Clarifications

### Session 2026-03-29

- Q: What is the intended delivery format of the calculator? → A: Library/API — exported functions/module (not a CLI or UI widget)
- Q: What angle unit should the sine function use? → A: Radians exclusively (no degree conversion provided)
- Q: What are the input range/numeric limits? → A: No explicit application-level limits; JavaScript `number` (IEEE 754 float64) bounds apply
- Q: What decimal precision should results support? → A: Up to 10 decimal places
- Q: Should the calculator support chaining or maintain state between calls? → A: Stateless — each operation call is fully independent; no internal state is retained

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A developer wants to perform everyday arithmetic calculations via the calculator library. They call an exported function with two numeric arguments and an operator, and the function immediately returns the correct numeric result. This is the core value of the calculator and must work as a standalone, complete API.

**Why this priority**: Arithmetic operations are the foundational capability of the calculator. All other functionality builds on top of this. Without it, the calculator has no value.

**Independent Test**: Can be fully tested by calling each arithmetic function with known inputs and asserting the returned value matches the expected result.

**Acceptance Scenarios**:

1. **Given** the calculator library is imported, **When** `add(8, 5)` is called, **Then** the function returns `13`.
2. **Given** the calculator library is imported, **When** `subtract(10, 4)` is called, **Then** the function returns `6`.
3. **Given** the calculator library is imported, **When** `multiply(6, 7)` is called, **Then** the function returns `42`.
4. **Given** the calculator library is imported, **When** `divide(15, 4)` is called, **Then** the function returns `3.75`.
5. **Given** the calculator library is imported, **When** `divide(9, 0)` is called, **Then** the function throws or returns a clear error indicating division by zero (no crash).

---

### User Story 2 - Sine Function Calculation (Priority: P2)

A developer needs to compute the sine of an angle expressed in **radians**. They call the exported `sin` function with a numeric radian value, and the function immediately returns the sine result as a JavaScript `number`. This is the only trigonometric function supported.

**Why this priority**: The sine function extends the calculator for scientific use cases. It is an explicit requirement but secondary to basic arithmetic. Arithmetic P1 can be shipped and demonstrated independently first.

**Independent Test**: Can be fully tested by calling `sin` with known radian values and asserting the returned value matches the expected sine result to 10 decimal places.

**Acceptance Scenarios**:

1. **Given** the calculator library is imported, **When** `sin(0)` is called, **Then** the function returns `0`.
2. **Given** the calculator library is imported, **When** `sin(Math.PI / 2)` is called (π/2 radians), **Then** the function returns `1` (within float64 precision).
3. **Given** the calculator library is imported, **When** `sin(Math.PI / 6)` is called (π/6 radians), **Then** the function returns `0.5` (within float64 precision).
4. **Given** the calculator library is imported, **When** a caller looks for `cos`, `tan`, or `cot` exports, **Then** those functions are not exported by the module.

---

### Edge Cases

- What happens when the caller divides by zero? → The function throws an error (or returns an error object); the library remains callable for subsequent operations.
- What happens when the caller passes a non-numeric input (e.g., `NaN`, `undefined`, a string)? → The function rejects the input gracefully by throwing a TypeError or returning a descriptive error; no crash.
- What happens when the result of a calculation is at or beyond JavaScript `number` (float64) bounds (i.e., `Infinity` or `-Infinity`)? → The function returns `Infinity`/`-Infinity` as per IEEE 754 semantics and this is documented behavior.
- What happens when the caller invokes `sin` on a non-numeric value? → The function throws a TypeError with a clear message.
- What happens after an error? → Each call is independent (stateless); subsequent calls proceed normally without any reset step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator library MUST export an `add(a, b)` function that accepts two JavaScript `number` values and returns their sum.
- **FR-002**: The calculator library MUST export a `subtract(a, b)` function that accepts two JavaScript `number` values and returns their difference.
- **FR-003**: The calculator library MUST export a `multiply(a, b)` function that accepts two JavaScript `number` values and returns their product.
- **FR-004**: The calculator library MUST export a `divide(a, b)` function that accepts two JavaScript `number` values and returns their quotient.
- **FR-005**: The `divide` function MUST prevent division by zero by throwing an error (or returning a descriptive error object) when the divisor is `0`; the library MUST NOT crash.
- **FR-006**: The calculator library MUST export a `sin(x)` function that accepts a numeric angle value expressed in **radians** and returns the sine of that angle as a JavaScript `number`.
- **FR-007**: The calculator library MUST NOT export cosine, tangent, cotangent, or any other trigonometric functions beyond `sin`.
- **FR-008**: All exported functions MUST handle non-numeric or invalid inputs (e.g., `NaN`, `undefined`, non-number types) gracefully by throwing a TypeError with a descriptive message; no function may crash the runtime.
- **FR-009**: Each exported function MUST be stateless — no internal mutable state is retained between calls; each invocation is fully independent.
- **FR-010**: All exported functions MUST accept any value within the JavaScript `number` (IEEE 754 float64) range; no application-level numeric limits are imposed beyond the float64 bounds.
- **FR-011**: Numeric results MUST be precise to up to 10 decimal places, consistent with JavaScript float64 arithmetic; results outside float64 range MUST follow IEEE 754 semantics (`Infinity`, `-Infinity`, `NaN`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four arithmetic functions (`add`, `subtract`, `multiply`, `divide`) return mathematically correct results for any valid JavaScript `number` input, verified by automated unit tests covering integers, floats, negatives, and boundary values.
- **SC-002**: The `sin` function returns results accurate to up to 10 decimal places for any valid radian input, verified against `Math.sin` reference values in the JavaScript runtime.
- **SC-003**: Division by zero and invalid inputs are handled without a runtime crash 100% of the time; the function throws or returns an error as specified (verified by negative-path unit tests).
- **SC-004**: Each exported function executes and returns in under 1 millisecond for any single call under normal conditions (no I/O; pure computation).
- **SC-005**: No trigonometric functions other than `sin` are exported or accessible from the module's public API.
- **SC-006**: Calling any exported function after a previous call that threw an error succeeds normally, confirming stateless isolation (verified by sequential error + success test sequences).

## Assumptions

- The calculator is implemented as a **JavaScript/TypeScript library module** that exports named functions (`add`, `subtract`, `multiply`, `divide`, `sin`). It is not a CLI tool, UI widget, or standalone application.
- The angle input for the `sin` function uses **radians** exclusively. No degree-to-radian conversion is provided by the library; callers are responsible for converting degrees to radians if needed.
- The calculator operates on real numbers within JavaScript `number` (IEEE 754 float64) range. Complex numbers and imaginary results are out of scope.
- All exported functions are **stateless**: no shared mutable state exists between calls. Each invocation is fully independent, and no session or history is maintained.
- Calculation history and persistence between calls or sessions are out of scope for this feature.
- Only the sine trigonometric function is in scope; all other trigonometric and inverse trigonometric functions (cos, tan, cot, arcsin, etc.) are explicitly excluded.
- Numeric precision follows JavaScript float64 arithmetic (up to ~15–17 significant digits); results are reported to up to 10 decimal places.
