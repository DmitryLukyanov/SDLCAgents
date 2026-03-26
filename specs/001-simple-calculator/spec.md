# Feature Specification: Simple Calculator

**Feature Branch**: `001-simple-calculator`  
**Created**: 2025-01-30  
**Status**: Draft  
**Jira**: TC-5

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic Operations (Priority: P1)

A user wants to perform standard arithmetic — addition, subtraction, multiplication, and division — using the calculator. This is the core value of the feature and must work correctly for the calculator to be useful at all.

**Why this priority**: Without these four operations the calculator has no usable value. Every other story depends on this working first.

**Independent Test**: Can be fully tested by supplying two numbers and an operator and verifying the correct result is returned; delivers a fully functional basic calculator.

**Acceptance Scenarios**:

1. **Given** two valid numbers, **When** the user requests addition (`+`), **Then** the calculator returns their exact sum
2. **Given** two valid numbers, **When** the user requests subtraction (`-`), **Then** the calculator returns the correct difference
3. **Given** two valid numbers, **When** the user requests multiplication (`*`), **Then** the calculator returns the correct product
4. **Given** two valid numbers, **When** the user requests division (`/`) and the divisor is non-zero, **Then** the calculator returns the correct quotient
5. **Given** two numbers that produce a decimal result, **When** any arithmetic operation is performed, **Then** the result preserves meaningful decimal precision

---

### User Story 2 - Sine Function (Priority: P2)

A user wants to compute the sine of a number using the calculator. This extends the calculator beyond basic arithmetic into trigonometry, as explicitly scoped in the Jira ticket (sin only; cos, tan, and cot are explicitly excluded).

**Why this priority**: Sine is the sole trigonometric function in scope; it extends the calculator's utility but the basic arithmetic (P1) must already be working.

**Independent Test**: Can be fully tested by providing a numeric value to the `sin` operation and verifying the returned result matches the mathematically expected sine value.

**Acceptance Scenarios**:

1. **Given** a valid numeric input in **radians**, **When** the user requests the sine (`calc sin <value>`), **Then** the calculator returns the mathematically correct sine value (delegating to JavaScript `Math.sin()`)
2. **Given** an input of `0`, **When** the user requests `sin`, **Then** the result is `0`
3. **Given** a negative number, **When** the user requests `sin`, **Then** the calculator returns the correct signed result
4. **Given** the user requests `cos`, `tan`, or `cot`, **Then** the calculator rejects the operation with a clear "unsupported operation" message

---

### User Story 3 - Error Handling for Invalid Inputs (Priority: P3)

A user accidentally provides an invalid or undefined input (e.g., divides by zero, or types a non-numeric value). The calculator must respond gracefully rather than crash or produce a misleading result.

**Why this priority**: Robustness matters but only once the happy paths (P1, P2) are proven correct.

**Independent Test**: Can be fully tested by submitting known invalid inputs and asserting that the calculator returns a clear, descriptive error rather than a wrong result.

**Acceptance Scenarios**:

1. **Given** a divisor of `0`, **When** the user requests division, **Then** the calculator returns a clear "division by zero" error message
2. **Given** a non-numeric input where a number is expected, **When** the user submits the operation, **Then** the calculator returns a clear "invalid input" error
3. **Given** an unrecognised operator symbol, **When** the user submits the operation, **Then** the calculator returns a clear "unsupported operation" error

---

### Edge Cases

- What is the result of `sin(0)`? → Expected: `0`
- What happens when the divisor is `0`? → Clear error, no crash
- What happens with very large numbers that overflow standard numeric ranges? → Behaviour should be documented
- What angle unit does `sin` use? → **Radians** (per FR-005, matching JavaScript `Math.sin()` convention)
- Does the calculator support chained / compound expressions (e.g., `2 + sin(45)`)? → **No**; single operation per invocation only (per FR-006)
- What interface does the user interact with? → **CLI**; invoked as `calc <operation> [operands]` (per FR-001)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST be implemented as a command-line tool (CLI) invokable as `calc <operation> [operands]` (e.g., `calc add 3 5`, `calc sin 1.5707`); it fits the existing TypeScript/Node.js project pattern and is the sole required delivery interface
- **FR-002**: The calculator MUST support addition (`+`), subtraction (`-`), multiplication (`*`), and division (`/`) on two numeric operands
- **FR-003**: The calculator MUST support the `sin` operation on a single numeric operand
- **FR-004**: The calculator MUST explicitly reject `cos`, `tan`, and `cot` operations with a descriptive "unsupported operation" message
- **FR-005**: The `sin` operation MUST accept angles in **radians**, matching the JavaScript `Math.sin()` convention; degree input is not supported and is out of scope
- **FR-006**: The calculator MUST process exactly **one operation per CLI invocation** — one operator plus its required operands (e.g., `calc add 3 5` or `calc sin 1.5707`); compound or chained expressions (e.g., `2 + 3 * sin(45)`) are explicitly out of scope and require no parser beyond simple argument splitting
- **FR-007**: The calculator MUST return a clear, human-readable error message for: division by zero, non-numeric inputs, and unsupported operations
- **FR-008**: The calculator MUST NOT crash or produce silent incorrect results for any supported or explicitly unsupported operation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four arithmetic operations produce correct results for a representative set of integer and decimal inputs (100% accuracy against expected values)
- **SC-002**: The `sin` operation produces a result within acceptable numeric precision (e.g., matches expected value to at least 6 significant figures) for a representative set of inputs
- **SC-003**: Invalid inputs (division by zero, non-numeric values, unsupported operators) always produce a descriptive error message — never a crash or silent wrong result (100% of defined error cases handled)
- **SC-004**: All five supported operations (`+`, `-`, `*`, `/`, `sin`) are independently verifiable through automated tests with a pass rate of 100%

## Assumptions

- Trigonometric functions beyond `sin` (cos, tan, cot, and others) are explicitly out of scope as stated in the Jira description
- The calculator operates on real numbers (integers and decimals); complex numbers are out of scope
- No persistent storage of calculation history is required — each calculation is stateless
- No user authentication or access control is required
- Numeric precision follows standard platform behaviour unless otherwise specified
- Compound/chained expressions are out of scope; each CLI invocation handles exactly one operation

## Clarifications

### Session 2026-03-26

- Q: What delivery interface should the calculator expose? → A: Command-line tool (CLI) — invoked as `calc <operation> [operands]` (e.g., `calc add 3 5`)
- Q: What angle unit does the `sin` operation accept? → A: Radians — matching the JavaScript `Math.sin()` convention
- Q: Does the calculator support compound/chained expressions? → A: No — single operation per invocation only; each call takes exactly one operator and its operands
