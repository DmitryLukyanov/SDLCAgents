# Feature Specification: Simple Calculator

**Jira Key**: `TC-5`  
**Feature Branch**: `001-simple-calculator`  
**Created**: 2025-01-01  
**Status**: Draft  
**Input**: Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Basic Arithmetic Operations (Priority: P1)

A developer imports the calculator module into their TypeScript project and calls arithmetic functions to perform addition, subtraction, multiplication, and division on numeric inputs, receiving the result as a numeric return value.

**Why this priority**: Arithmetic is the foundational capability. All other functionality depends on a correctly working numeric computation core. This story alone constitutes a usable MVP.

**Independent Test**: Can be fully tested by importing the module and calling each arithmetic function with known inputs; the return values are verified against expected numeric results.

**Acceptance Scenarios**:

1. **Given** the module is imported, **When** `add(3, 4)` is called, **Then** the result is `7`
2. **Given** the module is imported, **When** `subtract(10, 3)` is called, **Then** the result is `7`
3. **Given** the module is imported, **When** `multiply(4, 5)` is called, **Then** the result is `20`
4. **Given** the module is imported, **When** `divide(10, 2)` is called, **Then** the result is `5`
5. **Given** the module is imported, **When** `divide(7, 0)` is called, **Then** the module signals a division-by-zero error (throws an error or returns a defined error value)
6. **Given** the module is imported, **When** any arithmetic function is called with non-numeric input, **Then** the module signals an invalid-input error

---

### User Story 2 — Sine Trigonometric Operation (Priority: P2)

A developer calls the sine function on a numeric angle value expressed in radians, and receives the mathematically correct sine of that angle as a numeric return value.

**Why this priority**: Sine is an explicitly required capability per the feature description. It extends the calculator beyond basic arithmetic to cover a targeted scientific use case without adding unrequested trig functions.

**Independent Test**: Can be fully tested by calling `sin(angle)` with known radian values and comparing the output to reference values within an acceptable floating-point tolerance.

**Acceptance Scenarios**:

1. **Given** the module is imported, **When** `sin(0)` is called, **Then** the result is `0` (within floating-point tolerance)
2. **Given** the module is imported, **When** `sin(Math.PI / 2)` is called, **Then** the result is `1` (within floating-point tolerance)
3. **Given** the module is imported, **When** `sin(Math.PI)` is called, **Then** the result is approximately `0` (within floating-point tolerance)
4. **Given** the module is imported, **When** `sin(-Math.PI / 2)` is called, **Then** the result is `-1` (within floating-point tolerance)
5. **Given** the module is imported, **When** `sin` is called with a non-numeric input, **Then** the module signals an invalid-input error

---

### Edge Cases

- What happens when `divide` receives `0` as the divisor? → The module must signal a division-by-zero error (not silently return `Infinity` or `NaN`).
- What happens when any function receives `NaN`, `Infinity`, or `undefined`? → The module must signal an invalid-input error.
- What happens with very large or very small numeric inputs (e.g., `Number.MAX_VALUE`)? → The module returns the computed IEEE 754 result; no special clamping is required.
- What happens when `sin` receives negative radian values? → The module returns the mathematically correct sine result (e.g., `sin(-π/2) = -1`).
- What happens with inputs that are valid numbers but of type string (e.g., `"3"`)? → The module treats these as invalid and signals an error, because TypeScript typing enforces `number` at compile time; runtime validation must reject non-number values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The module MUST expose an `add(a: number, b: number): number` function that returns the sum of two numbers.
- **FR-002**: The module MUST expose a `subtract(a: number, b: number): number` function that returns the difference of two numbers.
- **FR-003**: The module MUST expose a `multiply(a: number, b: number): number` function that returns the product of two numbers.
- **FR-004**: The module MUST expose a `divide(a: number, b: number): number` function that returns the quotient of two numbers.
- **FR-005**: The `divide` function MUST throw an error when the divisor (`b`) is `0`.
- **FR-006**: The module MUST expose a `sin(angle: number): number` function that accepts an angle expressed in **radians** and returns its sine value.
- **FR-007**: The module MUST NOT expose cosine, tangent, cotangent, or any other trigonometric function beyond sine.
- **FR-008**: All functions MUST validate that their inputs are finite numbers and throw a descriptive error when inputs are `NaN`, `Infinity`, `-Infinity`, or any non-number type.
- **FR-009**: All functions MUST be exported from a single module entry point so consumers can import selectively or collectively.
- **FR-010**: The module MUST NOT produce side effects (no I/O, no global state mutation) — all functions are pure.

### Key Entities

- **Calculator Module**: The single TypeScript module (file or package) that is imported by consumers. It exposes the arithmetic and sine functions as named exports.
- **Numeric Input**: A finite IEEE 754 double-precision number provided as an argument. Invalid inputs (non-finite, non-number) are rejected with a descriptive error.
- **Computation Result**: A finite IEEE 754 double-precision number returned by each function, representing the mathematical result of the operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five operations (`add`, `subtract`, `multiply`, `divide`, `sin`) return correct results for at least 100 distinct valid numeric inputs each, verified by an automated test suite with zero failures.
- **SC-002**: Division by zero is rejected in 100% of cases — the module never silently returns `Infinity` or `NaN` for this case.
- **SC-003**: Invalid inputs (non-finite numbers, non-number types) are rejected in 100% of cases with a descriptive, human-readable error message.
- **SC-004**: The `sin` function results agree with a reference implementation to within `1e-10` absolute tolerance for all tested radian inputs.
- **SC-005**: The module exposes no functions other than `add`, `subtract`, `multiply`, `divide`, and `sin` in its public API (verified by static analysis of exports).
- **SC-006**: A developer can import and use any single function in under 5 lines of TypeScript without additional runtime configuration.

## Assumptions

- The calculator is a **programmatic TypeScript module** — there is no user interface (CLI, web, or otherwise) in scope for this feature.
- All angle inputs to `sin` are in **radians**. Degree conversion is out of scope.
- The module targets the TypeScript/Node.js ecosystem; no browser-specific or environment-specific behaviour is required.
- Floating-point arithmetic follows standard IEEE 754 double-precision rules. No arbitrary-precision or exact arithmetic is required.
- Only the five specified operations are in scope: `+`, `-`, `*`, `/`, and `sin`. No other mathematical functions will be added in this iteration.
- Error signalling is done via thrown `Error` instances with descriptive messages; no special error codes or result-object patterns are required unless the project's existing conventions dictate otherwise.
- The module has no external runtime dependencies — it relies only on the JavaScript/TypeScript standard library.
