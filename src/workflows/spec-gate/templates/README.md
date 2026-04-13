# Spec Gate Templates

These templates produce the PR comments posted by the Spec Gate workflow after
each spec-kit pipeline step completes. There are two possible outcomes:

- **Proceed** — gate passed, Copilot is told to continue to the next step.
- **HIL (Human-in-the-Loop)** — gate found issues (or the step was `implement`),
  a human must review before the pipeline continues.

Placeholders follow the `{{PLACEHOLDER_NAME}}` convention and are filled at
runtime by `fillTemplate(template, vars)` from `src/lib/template-utils.ts`.

---

## Placeholder reference

### `{{STEP_LABEL}}`

Human-readable name of the completed spec-kit step, including its position in
the sequence.

- **Format:** `<step> (<index>/<total>)` — e.g. `clarify (2/5)`
- **Source:** Derived from the `SPECKIT_STEP` environment variable and the
  `STEP_ORDER` constant in `spec-gate-types.ts`.
- **Used in:** `proceed-comment.md`

---

### `{{SUMMARY_LINE}}`

An optional one-line summary of the gate analysis result, rendered in italics
below the separator.

- **Format:** Either `\n_<summary text>_` (when a summary exists) or an
  **empty string** (when the LLM returned no summary). The leading `\n` is
  included in the value so the template line itself stays clean.
- **Source:** `result.summary` from `analyzeSpec()` in `analyze-spec.ts`.
- **Used in:** `proceed-comment.md`

---

### `{{HIL_MARKER}}`

HTML comment tag that downstream tooling (e.g. workflow triggers) uses to
identify the type of HIL comment.

- **Allowed values:**
  - `speckit-gate: hil` — issues were found in a non-implement step
  - `speckit-gate: hil-implement` — the `implement` step completed (always HIL)
- **Source:** Set in `buildHilComment()` in `spec-gate-agent.ts` based on
  whether `step === 'implement'`.
- **Used in:** `hil-comment.md`

---

### `{{HIL_HEADING}}`

The `##` heading shown at the top of the HIL comment.

- **Allowed values:**
  - `Spec Gate: Human Review Required ⚠️` — for non-implement steps with issues
  - `Spec Gate: Implementation Complete — Human Review Required ✅` — for the
    implement step
- **Source:** Set in `buildHilComment()` based on `step === 'implement'`.
- **Used in:** `hil-comment.md`

---

### `{{HIL_INTRO}}`

The introductory sentence explaining why human review is needed.

- **Format:** One sentence of Markdown prose.
- **Allowed values:**
  - Non-implement: `` The automated spec gate found **N issue(s)** in the `<step> (N/5)` artifacts that need resolution before proceeding. ``
  - Implement: `` The `implement` step has completed. This step always requires human review before merging. ``
- **Source:** Set in `buildHilComment()` based on step type and issue count.
- **Used in:** `hil-comment.md`

---

### `{{SUMMARY}}`

The gate analysis summary text returned by the LLM.

- **Format:** Plain text or Markdown, typically one or two sentences.
- **Source:** `result.summary` from `analyzeSpec()` in `analyze-spec.ts`.
  May be an empty string if the LLM returned no summary.
- **Used in:** `hil-comment.md`

---

### `{{ISSUES_SECTION}}`

A Markdown table listing every specific issue the gate found in the artifacts,
or an empty string when there are no issues (e.g. the implement step).

- **Format when non-empty:**
  ```markdown

  ### Issues Found

  | File | Line | Issue |
  |------|------|-------|
  | `path/to/file.md` | 12 | Description of the issue |
  ```
  The leading blank line is included in the value so spacing in the rendered
  comment is correct.
- **Format when empty:** `""` (empty string).
- **Source:** Built from `result.issues[]` in `buildHilComment()`. Each issue
  has `file` (string), `line` (number, `0` means unknown → rendered as `—`),
  and `text` (string, pipe characters escaped).
- **Used in:** `hil-comment.md`

---

### `{{HIL_FOOTER}}`

An action prompt appended at the bottom of the HIL comment telling the author
what to do next, or an empty string for the implement step (where no automated
retry is expected).

- **Allowed values:**
  - Non-implement: `\n---\n_Fix the issues above, then reply \`@copilot proceed\` to continue._`
  - Implement (`step === 'implement'`): `""` (empty string)
- **Source:** Set in `buildHilComment()` based on step type.
- **Used in:** `hil-comment.md`

---

## Templates

### `proceed-comment.md`

**Purpose:** Posted to the PR when the gate passes. The hidden HTML comment
(`<!-- speckit-gate: proceed -->`) is detected by the `_reusable-spec-gate.yml`
workflow to trigger the next pipeline step automatically.

**Placeholders:** `{{STEP_LABEL}}`, `{{SUMMARY_LINE}}`

**Example output (with summary):**
```markdown
<!-- speckit-gate: proceed -->
@copilot proceed

---
_Spec gate passed ✅ — no open issues detected in the `clarify (2/5)` artifacts._
_All acceptance criteria are clearly defined and unambiguous._
```

**Example output (no summary):**
```markdown
<!-- speckit-gate: proceed -->
@copilot proceed

---
_Spec gate passed ✅ — no open issues detected in the `specify (1/5)` artifacts._
```

---

### `hil-comment.md`

**Purpose:** Posted to the PR when human review is required — either because
the gate found issues or because the `implement` step always needs sign-off.
The hidden HTML comment is detected by `_reusable-spec-gate.yml` to pause the
pipeline and notify reviewers.

**Placeholders:** `{{HIL_MARKER}}`, `{{HIL_HEADING}}`, `{{HIL_INTRO}}`,
`{{SUMMARY}}`, `{{ISSUES_SECTION}}`, `{{HIL_FOOTER}}`

**Example output (issues found):**
```markdown
<!-- speckit-gate: hil -->
## Spec Gate: Human Review Required ⚠️

The automated spec gate found **2 issue(s)** in the `plan (3/5)` artifacts that need resolution before proceeding.

The plan is missing error-handling details for the authentication flow.

### Issues Found

| File | Line | Issue |
|------|------|-------|
| `plan.md` | 14 | No rollback strategy defined for database migration |
| `plan.md` | 27 | Authentication failure path not covered |

---
_Fix the issues above, then reply `@copilot proceed` to continue._
```

---

## How templates are loaded

```ts
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

const PROCEED_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'proceed-comment.md');
const HIL_TEMPLATE     = loadTemplate(import.meta.url, 'templates', 'hil-comment.md');

const comment = fillTemplate(PROCEED_TEMPLATE, {
  STEP_LABEL:   stepLabel(step),   // e.g. "clarify (2/5)"
  SUMMARY_LINE: summary ? `\n_${summary}_` : '',
}).trim();
```

Both builders call `.trim()` on the result to strip any trailing blank lines
that would appear when optional placeholders (e.g. `{{SUMMARY_LINE}}`,
`{{ISSUES_SECTION}}`, `{{HIL_FOOTER}}`) resolve to empty strings.
