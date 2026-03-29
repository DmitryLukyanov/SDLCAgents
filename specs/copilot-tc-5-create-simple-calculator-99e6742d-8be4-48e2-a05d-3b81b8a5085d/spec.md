# Feature Specification: Simple Calculator

**Feature Branch**: `copilot-tc-5-create-simple-calculator-99e6742d-8be4-48e2-a05d-3b81b8a5085d`
**Created**: 2025-07-15
**Last Clarified**: 2026-03-29
**Status**: Clarified
**Input**: User description: "Create calculator that supports basic operations like -, +, *, /. But on top of this it must support sin (only, do not add cos, tg, ctg)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Perform Basic Arithmetic (Priority: P1)

A user wants to compute the result of a basic arithmetic operation (addition, subtraction, multiplication, or division) on two numbers and see the result immediately.

**Why this priority**: Basic arithmetic is the core value of the calculator; all other functionality builds on top of it.

**Independent Test**: Can be fully tested by entering two numbers with an arithmetic operator and verifying the correct result is returned.

**Acceptance Scenarios**:

1. **Given** the REPL is running and displays `> `, **When** the user types `10 + 5` and presses Enter, **Then** the calculator displays `15` and re-displays the `> ` prompt
2. **Given** the REPL is running and displays `> `, **When** the user types `8 - 3` and presses Enter, **Then** the calculator displays `5` and re-displays the `> ` prompt
3. **Given** the REPL is running and displays `> `, **When** the user types `6 * 7` and presses Enter, **Then** the calculator displays `42` and re-displays the `> ` prompt
4. **Given** the REPL is running and displays `> `, **When** the user types `20 / 4` and presses Enter, **Then** the calculator displays `5` and re-displays the `> ` prompt
5. **Given** the REPL is running and displays `> `, **When** the user types `5 / 0` and presses Enter, **Then** the calculator displays a clear error message and re-displays the `> ` prompt (does not crash or exit)
6. **Given** the REPL is running and displays `> `, **When** the user types `2 + 3 * 4` and presses Enter, **Then** the calculator displays `14` (multiplication before addition)
7. **Given** the REPL is running and displays `> `, **When** the user types `(2 + 3) * 4` and presses Enter, **Then** the calculator displays `20` (parentheses override precedence)
8. **Given** the REPL is running and displays `> `, **When** the user types `-5 + 3` and presses Enter, **Then** the calculator displays `-2` (unary minus supported)
9. **Given** the REPL is running and displays `> `, **When** the user types `1 / 3` and presses Enter, **Then** the calculator displays up to 10 significant digits (e.g., `0.3333333333`)
10. **Given** the REPL is running and displays `> `, **When** the user types `exit` or `quit` and presses Enter, **Then** the calculator exits cleanly with no error
11. **Given** the REPL is running and displays `> `, **When** the user presses Ctrl+C, **Then** the calculator exits cleanly with no error

---

### User Story 2 - Compute Sine of a Number (Priority: P2)

A user wants to compute the sine of a number and see the result immediately.

**Why this priority**: `sin` is explicitly required in the issue; it extends the core arithmetic value with trigonometric capability.

**Independent Test**: Can be fully tested by entering `sin` with a numeric argument and verifying the result matches the expected sine value.

**Acceptance Scenarios**:

1. **Given** the REPL is running and displays `> `, **When** the user types `sin(0)` and presses Enter, **Then** the calculator displays `0`
2. **Given** the REPL is running and displays `> `, **When** the user types `sin(90)` and presses Enter, **Then** the calculator displays `1` (argument interpreted as degrees)
3. **Given** the REPL is running and displays `> `, **When** the user types `sin(180)` and presses Enter, **Then** the calculator displays a value within 0.0001 of `0` (floating-point precision artefact is acceptable)
4. **Given** the REPL is running and displays `> `, **When** the user types `10 + sin(30) * 2` and presses Enter, **Then** the calculator displays `11` (sin(30°) = 0.5, so 10 + 0.5 * 2 = 11)
5. **Given** the REPL is running and displays `> `, **When** the user types a non-numeric argument to `sin` (e.g., `sin(abc)`), **Then** the calculator displays a clear error message and re-displays the `> ` prompt

---

### Edge Cases

- **Division by zero**: Display a descriptive error message (e.g., `Error: division by zero`); return to `> ` prompt without crashing
- **Invalid / non-numeric input**: Display a descriptive error message; return to `> ` prompt without crashing
- **Unary minus**: Expressions beginning with `-` (e.g., `-5 + 3`) MUST evaluate correctly; `-5 + 3` → `-2`
- **Negative intermediate results**: Unary minus within sub-expressions (e.g., `3 * -2`) MUST evaluate correctly
- **Floating-point results**: Display up to 10 significant digits using JavaScript's native `number` type (IEEE 754 double); no special rounding library required
- **`sin` near-zero results**: `sin(180°)` produces a value very close to `0` due to floating-point arithmetic; display as-is (within 0.0001 of exact value is acceptable)
- **Exit commands**: Typing `exit` or `quit` (case-insensitive) exits gracefully; Ctrl+C also exits gracefully without an unhandled exception trace
- **Empty input**: If the user presses Enter with no input, re-display the `> ` prompt without an error

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calculator MUST support addition (`+`) of two numbers
- **FR-002**: The calculator MUST support subtraction (`-`) of two numbers
- **FR-003**: The calculator MUST support multiplication (`*`) of two numbers
- **FR-004**: The calculator MUST support division (`/`) of two numbers
- **FR-005**: The calculator MUST support the `sin` trigonometric function applied to a single numeric input
- **FR-006**: The calculator MUST NOT include `cos`, `tan` (`tg`), `cot` (`ctg`), or any other trigonometric function beyond `sin`
- **FR-007**: The calculator MUST display a clear, human-readable error message when division by zero is attempted
- **FR-008**: The calculator MUST display a clear, human-readable error message when invalid input is provided (e.g., non-numeric values, malformed expressions)
- **FR-009**: The calculator MUST operate as an **interactive REPL** (Read-Evaluate-Print Loop): on startup it displays a `> ` prompt, reads one expression per line, evaluates it, prints the result, then re-displays the `> ` prompt — continuing indefinitely until the user exits
- **FR-010**: The `sin` function MUST interpret its numeric argument as an angle expressed in **degrees** (e.g., `sin(90)` → `1`, `sin(0)` → `0`); radians mode is out of scope
- **FR-011**: The calculator MUST support full arithmetic expressions with standard operator precedence (multiplication and division before addition and subtraction) and parentheses for grouping (e.g., `2 + 3 * 4` → `14`; `(2 + 3) * 4` → `20`; `2 + 3 * sin(45)` is a valid expression)
- **FR-012**: The calculator MUST support the `sin` function embedded within larger expressions (e.g., `10 + sin(30) * 2`)
- **FR-013**: The calculator MUST exit cleanly when the user types `exit` or `quit` (case-insensitive) at the `> ` prompt and presses Enter
- **FR-014**: The calculator MUST exit cleanly when the user presses Ctrl+C (SIGINT); no unhandled-exception stack trace should be printed
- **FR-015**: The calculator MUST display numeric results with up to **10 significant digits** using JavaScript's native `number` type (IEEE 754 double-precision floating-point); no external arbitrary-precision library is required
- **FR-016**: The calculator MUST support **unary minus** so that expressions beginning with `-` (e.g., `-5 + 3`) and sub-expressions using unary negation (e.g., `3 * -2`) evaluate correctly
- **FR-017**: When the user presses Enter with an empty input line, the calculator MUST silently re-display the `> ` prompt without emitting an error message

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four arithmetic operations (`+`, `-`, `*`, `/`) produce correct results for valid inputs 100% of the time
- **SC-002**: The `sin` function produces correct results within ±0.0001 of the mathematically correct degree-based value for all tested angles
- **SC-003**: Division by zero and invalid inputs always result in a clear error message and prompt re-display, never a crash or silent failure
- **SC-004**: Users can obtain a calculation result in a single REPL cycle: type expression → press Enter → see result → see `> ` prompt again
- **SC-005**: Only the five explicitly listed operations (`+`, `-`, `*`, `/`, `sin`) are available — no additional trigonometric or scientific functions
- **SC-006**: The REPL exits within 500 ms of the user typing `exit`, `quit`, or pressing Ctrl+C
- **SC-007**: Floating-point results are displayed with up to 10 significant digits (e.g., `1 / 3` → `0.3333333333`); integer-valued results display without a decimal point (e.g., `6 * 7` → `42`)
- **SC-008**: Expressions using unary minus (e.g., `-5 + 3`, `3 * -2`) evaluate to the mathematically correct value 100% of the time

## Assumptions

- `cos`, `tg` (tan), and `ctg` (cot) are explicitly excluded per the issue description
- The calculator will operate with real numbers (integers and decimals); complex numbers are out of scope
- Calculation history / session persistence is out of scope for this version
- No user authentication or account management is required
- The CLI runs as an interactive REPL: it loops indefinitely displaying `> ` until the user types `exit`, `quit`, or sends Ctrl+C (SIGINT)
- Operator precedence follows standard mathematical rules (PEMDAS/BODMAS); parentheses are supported for grouping
- The `sin` function argument is always treated as degrees; no radians mode or toggle is provided
- Numeric results are rendered using JavaScript's native `number` type (IEEE 754 double); up to 10 significant digits are displayed; no external precision library is needed
- Unary minus is supported: expressions may begin with `-` or contain unary negation in sub-expressions (e.g., `3 * -2`)
- Integer-valued results (e.g., `6 * 7 = 42`) are displayed without a trailing `.0` or decimal point

## Clarifications

### Session 2025-07-15

- Q: What interface should the calculator use? → A: Command-line interface (CLI) — users type expressions in a terminal
- Q: What angle unit should `sin` use? → A: Degrees (e.g., `sin(90)` = 1)
- Q: What level of expression complexity is required? → A: Full expressions with standard operator precedence and parentheses (e.g., `2 + 3 * 4` = 14)

### Session 2026-03-29

- Q: What CLI run mode should the calculator use? → A: Interactive REPL loop — displays `> ` prompt, evaluates expression, prints result, then re-prompts; exits on `exit`, `quit`, or Ctrl+C
- Q: What decimal precision should results display? → A: Up to 10 significant digits using JavaScript's native `number` type (IEEE 754 double); no external precision library required
- Q: Should unary minus be supported? → A: Yes — unary minus is supported (e.g., `-5 + 3` → `-2`, `3 * -2` → `-6`); this is standard calculator behaviour
