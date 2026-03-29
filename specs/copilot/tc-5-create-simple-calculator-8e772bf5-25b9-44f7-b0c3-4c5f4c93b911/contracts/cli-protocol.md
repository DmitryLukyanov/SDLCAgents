# Contract: CLI REPL Protocol

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-29  
**Feature**: TC-5 Simple Calculator  
**Contract type**: CLI stdin/stdout text protocol

---

## Overview

The calculator CLI is an interactive REPL (Read-Eval-Print Loop). It reads one expression per line from `stdin`, evaluates it, and writes the result to `stdout`. Error messages are written to `stdout` as well (inline in the session), keeping the interface simple for human use; process-level errors (unexpected crashes) go to `stderr`.

---

## Invocation

```bash
# Run the REPL
npm run calculator

# Equivalent (direct)
tsx src/calculator/cli.ts
```

**Exit codes**:
| Condition | Exit code |
|-----------|-----------|
| User typed `exit` or `quit` | `0` |
| Process receives `SIGINT` (Ctrl-C) | `0` (readline handles gracefully) |
| Unhandled internal error | `1` |

---

## Session Lifecycle

```
[Process start]
      │
      ▼
Print banner line → stdout
      │
      ▼
Print prompt (`> `) → stdout (no newline)
      │
      ▼
Wait for line from stdin
      │
      ├── EOF (Ctrl-D / piped input exhausted) ──► exit 0
      │
      ├── "exit" or "quit" (case-insensitive) ──► print "Goodbye." → stdout ──► exit 0
      │
      └── any other string
              │
              ▼
        evaluate with calculate()
              │
              ├── SuccessResult ──► print value string → stdout
              │
              └── ErrorResult  ──► print error message → stdout
              │
              ▼
        Print prompt (`> `) → stdout (no newline)
        Wait for next line (loop)
```

---

## Input Grammar

One line per expression. Supported forms:

### Binary arithmetic
```
<number> <operator> <number>
```
- `<number>`: optional leading `-`, one or more digits, optional decimal part (`.` followed by digits).
- `<operator>`: one of `+`, `-`, `*`, `/`.
- Surrounding whitespace around the operator is optional.
- Examples: `5 + 3`, `10-4`, `-3.5 * 2`, `15 / 3`

### Unary sine
```
sin(<number>)
```
- `<number>`: same format as above; interpreted as **degrees**.
- Whitespace inside the parentheses is tolerated.
- Examples: `sin(30)`, `sin( -90 )`, `sin(0)`

### Session control keywords
- `exit` — terminates the session.
- `quit` — alias for `exit`.
- Case-insensitive (`EXIT`, `Quit` both accepted).

---

## Output Format

### Success
A single line containing the formatted number, followed by a newline:
```
> 5 + 3
8
> 1 / 3
0.3333333333
> sin(30)
0.5
```

**Number formatting rules** (FR-009):
- Plain integer if no fractional part: `8` not `8.0`.
- Up to 10 significant digits, trailing zeros stripped: `0.3333333333`, not `0.33330000`.
- `sin(90)` → `1` (not `1.0`).

### Error
A single descriptive line, followed by a newline. The REPL continues:
```
> 7 / 0
Division by zero is not allowed.
> cos(30)
Unsupported operation. Supported: +, -, *, /, sin.
> 5 +
Incomplete expression. Expected: <number> <+|-|*|/> <number>.
>
Please enter a valid expression.
```

### Session control
```
> exit
Goodbye.
[process exits 0]
```

---

## Sample Session (end-to-end)

```
Calculator REPL — type "exit" to quit
> 5 + 3
8
> 10 - 4
6
> 6 * 7
42
> 15 / 3
5
> 7 / 0
Division by zero is not allowed.
> sin(0)
0
> sin(30)
0.5
> sin(90)
1
> sin(-90)
-1
> cos(30)
Unsupported operation. Supported: +, -, *, /, sin.
> 5 +
Incomplete expression. Expected: <number> <+|-|*|/> <number>.
>
Please enter a valid expression.
> exit
Goodbye.
```

---

## Standard Streams

| Stream | Usage |
|--------|-------|
| `stdin` | User input (expression lines) |
| `stdout` | Banner, prompt, results, error messages, goodbye message |
| `stderr` | Unexpected process-level errors only (not user-facing expression errors) |

---

## Non-Goals

- **Machine-readable output**: No JSON or structured format; this is a human REPL.
- **Piped batch mode**: Single-shot invocation with `echo "5 + 3" | npm run calculator` is not a supported use-case; the REPL will process the line and then exit on EOF, which is an acceptable side-effect but is not tested.
- **Colour / ANSI**: No ANSI escape codes; plain text only.
- **History / arrow-key navigation**: `node:readline` provides basic line editing; persistent history is out of scope.
