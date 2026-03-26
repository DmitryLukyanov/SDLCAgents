# Specification

## Global directive (all agents)

Do not assume, ask

## Intent (Spec Kit — specify)

Clarify what should be built from the Jira issue below: scope, goals, and acceptance criteria.

## Source: Jira TC-5

### Summary

Create simple calculator

### Description

Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin  (only, do not add cos, tg, ctg)

---

# Feature Specification: Simple Calculator

**Feature Branch**: `tc-5-create-simple-calculator`
**Created**: 2026-03-26
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Basic Arithmetic (Priority: P1)

A user wants to perform basic arithmetic: addition, subtraction, multiplication, and division on two numbers.

**Why this priority**: These are the fundamental operations of any calculator. Without them the feature has no value.

**Independent Test**: Run `calculator add 3 4` and get `7`; run `calculator divide 10 2` and get `5`.

**Acceptance Scenarios**:

1. **Given** two numbers, **When** the user adds them, **Then** the result equals their sum.
2. **Given** two numbers, **When** the user subtracts the second from the first, **Then** the result equals their difference.
3. **Given** two numbers, **When** the user multiplies them, **Then** the result equals their product.
4. **Given** two non-zero numbers, **When** the user divides the first by the second, **Then** the result equals their quotient.
5. **Given** a divisor of zero, **When** the user divides, **Then** the system returns an error instead of crashing.

---

### User Story 2 — Sine Function (Priority: P2)

A user wants to compute the sine of an angle (in radians).

**Why this priority**: This is the only trigonometric function required; it extends the calculator beyond pure arithmetic.

**Independent Test**: Run `calculator sin 0` and get `0`; run `calculator sin 1.5707963267948966` and get approximately `1`.

**Acceptance Scenarios**:

1. **Given** an angle in radians, **When** the user requests `sin`, **Then** the result equals `Math.sin(angle)`.
2. **Given** `sin(0)`, **Then** the result is exactly `0`.
3. **Given** `sin(π/2)`, **Then** the result is approximately `1`.

---

### Edge Cases

- Division by zero: return an error / throw a descriptive error rather than returning `Infinity` or `NaN`.
- Non-numeric input: validate at system boundaries and return a meaningful error.
- Very large numbers: rely on standard IEEE-754 double precision; no special handling needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support addition of two numbers.
- **FR-002**: System MUST support subtraction of two numbers.
- **FR-003**: System MUST support multiplication of two numbers.
- **FR-004**: System MUST support division of two numbers, with a guard against division by zero.
- **FR-005**: System MUST support `sin(x)` where `x` is in radians.
- **FR-006**: System MUST NOT implement `cos`, `tan`, `cot`, or any other trigonometric function.
- **FR-007**: System MUST validate inputs and surface meaningful errors for invalid operands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five operations (`add`, `subtract`, `multiply`, `divide`, `sin`) produce correct results for a representative set of inputs.
- **SC-002**: Division by zero produces an explicit error (no `Infinity` or `NaN` leaked to the caller).
- **SC-003**: TypeScript typecheck (`tsc --noEmit`) passes with no errors.
- **SC-004**: Tests cover happy-path and the division-by-zero edge case.

## Assumptions

- Input numbers are standard JavaScript floating-point (IEEE-754 double precision); no arbitrary precision is needed.
- The `sin` function takes its argument in **radians** (matching `Math.sin`).
- The calculator is exposed as a TypeScript library and an optional CLI; no UI (web/mobile) is in scope.
- No persistence or session state is required; each operation is stateless.
