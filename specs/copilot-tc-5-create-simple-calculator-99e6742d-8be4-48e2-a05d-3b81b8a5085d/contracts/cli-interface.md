# CLI Interface Contract: Simple Calculator

**Phase**: 1 — Design & Contracts
**Date**: 2026-03-29
**Feature**: Simple Calculator CLI REPL

This document is the **normative contract** for the calculator's command-line interface. Any
implementation that satisfies all rules below is considered correct; any implementation that
violates a MUST rule is non-conformant.

---

## 1. Invocation

```
tsx src/calculator/index.ts
```

Or via npm script (after `package.json` is updated):

```
npm run calculator
```

No command-line arguments. No environment variables. No configuration files.

---

## 2. Startup Behaviour

- The process writes the prompt string `> ` to **stdout** immediately on startup.
- No banner, version string, or welcome message is printed.

```
> _
```

---

## 3. Prompt

| Property | Value |
|---|---|
| Prompt string | `> ` (greater-than, space) |
| Stream | stdout |
| Timing | Printed after every evaluation cycle (success or error) and on startup |

---

## 4. Input

- One expression per line.
- Input is read from **stdin** (interactive terminal or piped).
- Lines are trimmed of leading/trailing whitespace before processing.

---

## 5. Expression Syntax

Expressions conform to the following grammar (see `data-model.md` for full EBNF):

```
expression  ::= term ( ( '+' | '-' ) term )*
term        ::= unary ( ( '*' | '/' ) unary )*
unary       ::= '-' unary | primary
primary     ::= NUMBER | 'sin' '(' expression ')' | '(' expression ')'
```

### Supported tokens

| Token | Examples |
|---|---|
| Integer literal | `0`, `42`, `100` |
| Decimal literal | `3.14`, `.5`, `1.0` |
| Operators | `+`, `-`, `*`, `/` |
| Grouping | `(`, `)` |
| Function | `sin` (only) |

### NOT supported

- `cos`, `tan`, `cot`, `log`, `sqrt`, or any function other than `sin`
- Multi-character operators (`**`, `//`)
- Variables or identifiers other than `sin`
- Implicit multiplication (`2(3+1)` is invalid)

---

## 6. Output — Normal Result

- The result is written to **stdout** followed by a newline (`\n`).
- Formatted with up to 10 significant digits.
- Integer-valued results display without a decimal point.
- The prompt `> ` is re-displayed immediately after.

```
> 10 + 5
15
> 1 / 3
0.3333333333
> sin(90)
1
> (2 + 3) * 4
20
> -5 + 3
-2
>
```

---

## 7. Output — Error Result

- The error message is written to **stdout** (not stderr) followed by a newline.
- Format: `Error: <message>` where `<message>` is a human-readable description.
- The prompt `> ` is re-displayed immediately after.
- The process does **not** exit on an error.

```
> 5 / 0
Error: Division by zero
> sin(abc)
Error: Unexpected character 'a'
> cos(45)
Error: Unknown function 'cos'
> (2 + 3
Error: Expected ')'
>
```

### Error Message Catalogue

| Condition | Message |
|---|---|
| Division by zero | `Error: Division by zero` |
| Unexpected character in input | `Error: Unexpected character '<ch>'` |
| Unknown function name | `Error: Unknown function '<name>'` |
| Missing closing parenthesis | `Error: Expected ')'` |
| Trailing garbage after expression | `Error: Unexpected token '<tok>'` |

---

## 8. Empty Input

If the user presses Enter with no characters (or only whitespace):

- No error message is printed.
- The prompt `> ` is re-displayed silently.

```
>
>
>
```

---

## 9. Exit Commands

| Trigger | Behaviour |
|---|---|
| User types `exit` (case-insensitive) and presses Enter | Process exits with code `0` |
| User types `quit` (case-insensitive) and presses Enter | Process exits with code `0` |
| User presses Ctrl+C (SIGINT) | Process exits with code `0` |

- No farewell message is printed.
- No stack trace is printed.
- Exit MUST complete within 500 ms of the trigger.

---

## 10. Signal Handling

| Signal | Behaviour |
|---|---|
| `SIGINT` (Ctrl+C) | Close readline interface; `process.exit(0)` |
| All others | Default Node.js behaviour (not overridden) |

---

## 11. Streams

| Stream | Usage |
|---|---|
| `stdin` | Reading user input (interactive or piped) |
| `stdout` | All output: prompts, results, errors |
| `stderr` | Not used by the calculator |

---

## 12. Exit Codes

| Code | Condition |
|---|---|
| `0` | Normal exit (`exit`, `quit`, or Ctrl+C) |
| Non-zero | Abnormal termination (uncaught exception — should not occur) |

---

## 13. Compliance Checklist

Implementations MUST satisfy all items marked **MUST**. Items marked **MUST NOT** are hard
prohibitions.

| # | Rule | Priority |
|---|---|---|
| C-01 | Prompt is exactly `> ` (greater-than, space) | MUST |
| C-02 | Results written to stdout | MUST |
| C-03 | Errors written to stdout as `Error: <message>` | MUST |
| C-04 | Process does not exit on evaluation error | MUST |
| C-05 | `sin` argument interpreted as degrees | MUST |
| C-06 | `cos`, `tan`, `cot` are not supported | MUST NOT |
| C-07 | External runtime npm packages | MUST NOT |
| C-08 | Stack traces printed to terminal on any error | MUST NOT |
| C-09 | Process exits cleanly on `exit`, `quit`, Ctrl+C | MUST |
| C-10 | Empty input silently re-prompts (no error) | MUST |
| C-11 | Results display up to 10 significant digits | MUST |
| C-12 | Integer results display without decimal point | MUST |
