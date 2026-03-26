# Feature Specification: Simple Calculator

**Jira Issue**: `TC-5`  
**Created**: 2025-01-30  
**Status**: Draft  
**Input**: Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)

## Clarifications

### Session 2026-03-26

- Q: How should the library module signal errors (division by zero, invalid input) — throw exceptions or return a discriminated union type? → A: Throw `Error` instances (JavaScript/Node.js idiomatic; no Result monad infrastructure required).
- Q: What specific exit code should the CLI use for all error conditions, and should unsupported-operator errors also exit non-zero? → A: Exit code `1` for all error conditions — division by zero, non-numeric input, and unsupported operators all exit with code `1`.
- Q: What is the exact output precision rule — how many decimal places, and how should integers and whole-number results display? → A: Maximum 10 decimal places; trailing zeros are trimmed; integers display without a decimal point (e.g., `2+3 → 5`, `1/3 → 0.3333333333`, `1/4 → 0.25`).
- Q: How should negative numbers be passed as CLI arguments given that POSIX shells may interpret `-5` as a flag? → A: The CLI MUST accept negative numbers without special syntax (e.g., `calc -5 + 3`); the argument parser MUST treat any token matching a leading minus followed by digits as a numeric value, not an option flag.
- Q: Which automated test framework should be used, given the project has no test runner in `package.json`? → A: Node.js built-in test runner (`node:test`); zero new dependencies, ESM-native, available in Node 20+.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Arithmetic via CLI (Priority: P1)

As a user, I want to perform basic arithmetic operations (addition, subtraction, multiplication, division) from the command line so that I can quickly compute results without opening a separate application.

**Why this priority**: Core arithmetic is the fundamental purpose of a calculator. Without it, nothing else in the feature has value. This is the minimum viable slice.

**Independent Test**: Can be fully tested by running the CLI with two numeric operands and an operator (e.g., `calc 10 + 5`) and verifying the correct result is printed. Delivers immediate standalone value.

**Acceptance Scenarios**:

1. **Given** a user runs the calculator with two numbers and the `+` operator, **When** the command is executed, **Then** the sum of the two numbers is printed to standard output.
2. **Given** a user runs the calculator with two numbers and the `-` operator, **When** the command is executed, **Then** the difference is printed to standard output.
3. **Given** a user runs the calculator with two numbers and the `*` operator, **When** the command is executed, **Then** the product is printed to standard output.
4. **Given** a user runs the calculator with two numbers and the `/` operator, **When** the command is executed, **Then** the quotient is printed to standard output.
5. **Given** a user attempts to divide by zero, **When** the command is executed, **Then** a clear, human-readable error message is displayed and no result is printed.

---

### User Story 2 - Sine Function via CLI (Priority: P2)

As a user, I want to compute the sine of a number from the command line so that I can perform trigonometric calculations without needing a separate tool.

**Why this priority**: The `sin` function is the only trigonometric requirement and extends the calculator beyond basic arithmetic. It depends on the CLI being in place (P1), but delivers distinct, independently testable value once P1 exists.

**Independent Test**: Can be fully tested by running the CLI with the `sin` command and a numeric argument (e.g., `calc sin 1.5708`) and verifying the result approximates `1` (sin of π/2). Delivers standalone value for trigonometric use cases.

**Acceptance Scenarios**:

1. **Given** a user runs the calculator with the `sin` operator and a numeric argument in radians, **When** the command is executed, **Then** the sine value is printed to standard output.
2. **Given** a user provides `0` as the argument to `sin`, **When** the command is executed, **Then** the result `0` is printed.
3. **Given** a user provides a negative number as the argument to `sin`, **When** the command is executed, **Then** the correct negative sine value is printed.

---

### User Story 3 - Programmatic Library Usage (Priority: P3)

As a developer, I want to import the calculator as a TypeScript module so that I can embed arithmetic and sine calculations in other programs without spawning a CLI process.

**Why this priority**: The library interface enables reuse in other parts of the codebase and is explicitly required. However, the CLI (P1, P2) must function first, so this is a lower priority deliverable.

**Independent Test**: Can be fully tested by importing the module and calling each exported function with known inputs, asserting the return values are correct — entirely independent of the CLI.

**Acceptance Scenarios**:

1. **Given** the module is imported, **When** the addition function is called with two numbers, **Then** the correct sum is returned.
2. **Given** the module is imported, **When** the `sin` function is called with a number in radians, **Then** the correct sine value is returned.
3. **Given** the module is imported, **When** division by zero is attempted, **Then** the function throws a JavaScript `Error` instance rather than returning `Infinity` or `NaN` silently.

---

### Edge Cases

- What happens when the user provides non-numeric input (e.g., `calc foo + 5`)? → A clear error message is displayed and the CLI exits with code `1`; no result is printed.
- What happens when the user provides too few or too many arguments? → A usage hint is displayed explaining the correct command format and the CLI exits with code `1`.
- What happens when the user divides by zero? → A descriptive error message is shown (e.g., "Division by zero is not allowed") and the CLI exits with code `1`.
- What happens when `sin` is called with an extremely large number? → The result is computed and displayed; no crash occurs.
- What happens when the user types an unsupported operator (e.g., `cos`, `tg`)? → A clear error message states the operator is not supported, lists the supported ones (`+`, `-`, `*`, `/`, `sin`), and the CLI exits with code `1`.
- What happens when floating-point results have many decimal places? → Results are displayed with at most 10 decimal places, trailing zeros trimmed (e.g., `1/3 → 0.3333333333`, `1/4 → 0.25`).
- What happens when the user passes a negative number as a CLI operand (e.g., `calc -5 + 3`)? → The CLI interprets `-5` as the number negative five (not as a flag) and returns `−2`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition (`+`), subtraction (`-`), multiplication (`*`), and division (`/`) of two numeric operands.
- **FR-002**: The calculator MUST support the `sin` trigonometric function accepting a single numeric operand expressed in radians.
- **FR-003**: The calculator MUST NOT support any trigonometric functions other than `sin` (e.g., `cos`, `tan`, `cot` are explicitly excluded).
- **FR-004**: The calculator MUST expose a CLI interface that accepts operations and operands as command-line arguments and prints the result to standard output.
- **FR-005**: The calculator MUST be available as an importable TypeScript module exposing each operation as a named export.
- **FR-006**: The CLI MUST display a human-readable error message when division by zero is attempted, and exit with status code `1`.
- **FR-007**: The CLI MUST display a human-readable error message when non-numeric input is provided for any numeric operand, and exit with status code `1`.
- **FR-008**: The CLI MUST display a usage message when an unsupported operator is given, listing all supported operators, and exit with status code `1`.
- **FR-009**: The library module MUST throw a JavaScript `Error` instance for invalid operations (division by zero, non-numeric input) rather than returning `Infinity`, `NaN`, or a discriminated union type. Callers use standard `try/catch` error handling.
- **FR-010**: Numeric results MUST be displayed with at most 10 decimal places; trailing zeros after the decimal point MUST be trimmed; whole-number results (e.g., `2 + 3`) MUST be displayed without a decimal point (e.g., `5`, not `5.0` or `5.0000000000`).
- **FR-011**: The CLI MUST accept negative numbers as operands without requiring special syntax or quoting (e.g., `calc -5 + 3` is valid). The argument parser MUST treat any token matching a leading minus sign immediately followed by digits (e.g., `-5`, `-3.14`) as a numeric value, not as an option flag.

### Key Entities

- **Operation**: A computation request consisting of an operator (`+`, `-`, `*`, `/`, `sin`) and one or two numeric operands. Binary operations require two operands; `sin` requires one.
- **Result**: The numeric outcome of an operation, or an error descriptor when the operation cannot be performed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can perform any supported arithmetic operation from the CLI in a single command with no additional setup, receiving a correct result within 1 second.
- **SC-002**: A user can compute the sine of any real number from the CLI in a single command, receiving a correct result within 1 second.
- **SC-003**: 100% of invalid inputs (non-numeric arguments, unsupported operators, division by zero) produce a descriptive error message rather than an unhandled crash or silent incorrect output.
- **SC-004**: The module can be imported by another TypeScript file and all five operations (`+`, `-`, `*`, `/`, `sin`) can be called as functions with correct return values verified by automated tests.
- **SC-005**: Attempting to use any excluded trigonometric function (e.g., `cos`) via the CLI results in a clear "not supported" message rather than a silent failure or unrelated error.

## Assumptions

- Numeric operands are standard decimal numbers (integers or floating-point); scientific notation input is not required for v1.
- The `sin` function accepts its argument in **radians** (standard mathematical convention); degrees are out of scope.
- Output precision is at most 10 decimal places with trailing zeros trimmed; integers are displayed without a decimal point (e.g., `5`, not `5.0`). This resolves the vague "reasonable decimal places" language in FR-010.
- The CLI is invoked as a single executable command (e.g., via `npx tsx` or a compiled binary entry point); no interactive REPL mode is required.
- No persistent state (history, memory slots) is needed; each invocation is stateless.
- The library and CLI are targeted at Node.js ≥ 20 runtime environments using ESM modules (`"type": "module"`, `module: "NodeNext"`) consistent with the existing project toolchain.
- Automated tests are written using the Node.js built-in test runner (`node:test`); no additional test framework dependency is introduced.
- No localisation or internationalisation of error messages is required for v1.
- Negative numbers may be passed directly as CLI operands (e.g., `-5`) without quoting or `--` separator; the argument parser must handle this.
