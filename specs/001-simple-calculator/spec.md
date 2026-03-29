# Feature Specification: Simple Calculator

**Jira**: TC-5  
**Feature Branch**: `001-simple-calculator`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## Clarifications

### Session 2026-03-29

- Q: What is the delivery format for the calculator? → A: Library/module — importable TypeScript functions (e.g., `add(a, b)`, `divide(a, b)`, `sinDeg(x)`).
- Q: How are operands provided to arithmetic operations — as a parsed expression string or as discrete numeric arguments? → A: Discrete numeric arguments per function; no expression-string parsing.
- Q: What is the decimal display rule for non-integer results — always show 4 dp, or only show 4 dp when the result is not a whole number? → A: Show exactly 4 decimal places only for non-integer results; integer results display without decimal places.
- Q: What are the supported numeric bounds — JavaScript native limits or an explicit custom range? → A: Standard JavaScript limits — ±`Number.MAX_SAFE_INTEGER` (±9,007,199,254,740,991) for integers; full IEEE 754 double-precision range for floats.
- Q: Are chained expressions (e.g., `2 + 3 * 4`) in or out of scope? → A: Explicitly out of scope — single operation per function invocation only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A user needs to perform everyday arithmetic calculations — addition, subtraction, multiplication, and division — using a calculator. They enter two numbers and an operator, then receive an immediate, accurate result.

**Why this priority**: Arithmetic operations are the core purpose of the calculator and deliver standalone value even without any other feature. Without this, the tool is unusable.

**Independent Test**: Can be fully tested by entering numeric inputs with any of the four operators (+, -, *, /) and verifying the correct result is returned.

**Acceptance Scenarios**:

1. **Given** a valid numeric input pair, **When** `add(8, 5)` is called, **Then** the return value is `13`.
2. **Given** a valid numeric input pair, **When** `subtract(10, 4)` is called, **Then** the return value is `6`.
3. **Given** a valid numeric input pair, **When** `multiply(6, 7)` is called, **Then** the return value is `42`.
4. **Given** a valid numeric input pair, **When** `divide(20, 4)` is called, **Then** the return value is `5`.
5. **Given** a divisor of zero, **When** `divide(7, 0)` is called, **Then** an error is thrown with the message `"Cannot divide by zero"` and no unhandled exception propagates.

---

### User Story 2 - Sine Function (Priority: P2)

A user needs to calculate the sine of an angle. They enter an angle value, apply the sine function, and receive the result expressed as a decimal number.

**Why this priority**: The sine function extends the calculator beyond basic arithmetic and is an explicitly requested capability. It depends on the basic calculator being functional (P1) but can be demonstrated and tested independently once input handling is in place.

**Independent Test**: Can be fully tested by passing a known angle value to `sinDeg` and confirming the result matches the expected value (e.g., `sinDeg(0)` = `0`, `sinDeg(90)` = `1`).

**Acceptance Scenarios**:

1. **Given** a numeric angle input, **When** `sinDeg(0)` is called, **Then** the return value is `0`.
2. **Given** a numeric angle input in degrees, **When** `sinDeg(90)` is called, **Then** the return value is `1`.
3. **Given** a numeric angle input in degrees, **When** `sinDeg(30)` is called, **Then** the return value is `0.5`.
4. **Given** a non-numeric argument, **When** `sinDeg` is called with it, **Then** an error is thrown with a clear message and no unhandled exception propagates.

---

### Edge Cases

- What happens when a function is called with no argument or `undefined`? → An error is thrown with a descriptive message; no unhandled exception propagates.
- What happens when division by zero is attempted? → `divide(a, 0)` throws an error with message `"Cannot divide by zero"`.
- What happens when a value exceeds JavaScript's safe integer range (>`Number.MAX_SAFE_INTEGER` = 9,007,199,254,740,991) or the IEEE 754 double range? → The function throws an error with message `"Input exceeds supported numeric range"`.
- What happens when a non-numeric value (`NaN`, a string, `null`, `undefined`) is provided as an operand? → The function throws a `TypeError` with a clear descriptive message.
- What happens when `sinDeg` is called with a negative angle? → The correct signed result is returned (e.g., `sinDeg(-90)` returns `-1`).
- What happens when the result of a calculation is not a whole number (e.g., `divide(1, 3)`)? → The result is returned as a number rounded to exactly 4 decimal places (e.g., `0.3333`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition (`+`) of two numeric values via an exported `add(a: number, b: number): number` function.
- **FR-002**: The calculator MUST support subtraction (`-`) of two numeric values via an exported `subtract(a: number, b: number): number` function.
- **FR-003**: The calculator MUST support multiplication (`*`) of two numeric values via an exported `multiply(a: number, b: number): number` function.
- **FR-004**: The calculator MUST support division (`/`) of two numeric values via an exported `divide(a: number, b: number): number` function, and MUST throw an error with the message `"Cannot divide by zero"` when the divisor is zero.
- **FR-005**: The calculator MUST support the sine function applied to a single numeric input (interpreted in **degrees**) via an exported `sinDeg(x: number): number` function.
- **FR-006**: The calculator MUST NOT include cosine, tangent, cotangent, or any other trigonometric functions beyond `sinDeg`.
- **FR-007**: Each exported function MUST throw a `TypeError` with a descriptive message when passed a non-numeric, `NaN`, `null`, or `undefined` argument.
- **FR-008**: Each function MUST return results rounded to exactly **4 decimal places** for non-integer results; integer results MUST be returned as whole numbers without decimal padding (e.g., `add(8, 5)` returns `13`, not `13.0000`; `divide(1, 3)` returns `0.3333`).
- **FR-009**: Each function MUST throw an error with the message `"Input exceeds supported numeric range"` if any operand exceeds ±`Number.MAX_SAFE_INTEGER` (±9,007,199,254,740,991) or falls outside the IEEE 754 double-precision range.
- **FR-010**: The calculator MUST be delivered as an importable TypeScript module; all operations are exposed as individually named exported functions (no default class or expression-string parser).
- **FR-011**: Each operation function MUST accept only discrete numeric arguments — expression-string parsing (e.g., parsing `"8 + 5"`) is explicitly out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four arithmetic functions (`add`, `subtract`, `multiply`, `divide`) return correct results for 100% of valid numeric inputs tested.
- **SC-002**: `sinDeg` returns correct results within ±0.0001 tolerance for standard angle values (0°, 30°, 45°, 90°, 180°, 270°, 360°) and correct signed values for negative angles.
- **SC-003**: Division by zero and invalid/non-numeric inputs are handled by thrown errors — no unhandled exceptions occur in any test scenario.
- **SC-004**: Each operation is completed in a single function call; no multi-step interaction is required to obtain a result.
- **SC-005**: No trigonometric functions other than `sinDeg` are exported from the module.

## Assumptions

- The sine function input is interpreted in **degrees** (not radians); radians support is explicitly out of scope.
- The calculator is delivered as an importable TypeScript module; no CLI, REPL, or web UI is in scope for this version.
- Each operation function accepts discrete numeric arguments; expression-string parsing is explicitly out of scope.
- Non-integer results are returned rounded to exactly 4 decimal places; integer results are returned as whole numbers without decimal padding.
- Supported numeric range is ±`Number.MAX_SAFE_INTEGER` (±9,007,199,254,740,991) for integers and the full IEEE 754 double-precision range for floats; inputs outside this range produce a thrown error.
- Chained expressions (e.g., `2 + 3 * 4`) are explicitly out of scope — each function call handles exactly one operation.
- The calculator is a single-purpose computational module; no calculation history or persistent state is required for this version.
- No user authentication or session management is required.
