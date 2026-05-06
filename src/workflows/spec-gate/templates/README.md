# Spec Gate Templates

These templates produce the PR comments posted by the Spec Gate workflow after
each spec-kit pipeline step completes. There are two possible outcomes:

- **Proceed** — gate passed; `spec-gate-agent.ts` dispatches **Developer Agent — Proceed**, then posts a status PR comment.
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
- **Used in:** `pr-comment-proceed.md`

---

### `{{SUMMARY_BLOCK}}`

An optional italic summary of the gate analysis result, placed after the HTML marker.

- **Format:** Either `\n_<summary text>_` (when a summary exists) or an
  **empty string** (when the LLM returned no summary).
- **Source:** `result.summary` from `interpretGateCodexOutput()` in `analyze-spec.ts`.
- **Used in:** `pr-comment-proceed.md`

---

### `{{HIL_MARKER}}`

HTML comment tag that downstream tooling (e.g. workflow triggers) uses to
identify the type of HIL comment.

- **Allowed values:**
  - `speckit-gate: hil` — issues were found in a non–code_review step (not `implement`)
  - `speckit-gate: hil-implement` — the `implement` step (always HIL)
  - `speckit-gate: hil-code-review` — the `code_review` step (merge / request changes)
- **Source:** Set in `buildHilComment()` in `spec-gate-agent.ts` based on
  whether `step === 'implement'`.
- **Used in:** `hil-comment.md`

---

### `{{HIL_HEADING}}`

The `##` heading shown at the top of the HIL comment.

- **Allowed values:**
  - `Spec Gate: Human Review Required ⚠️` — non-implement, non–code_review HIL
  - `Spec Gate: Implementation — Fix Before Code Review ⚠️` — implement with issues
  - `Spec Gate: Implementation — Manual Check Required ⚠️` — implement with no issues
  - `Spec Gate: Code Review Complete — Human Merge Required ✅` — `code_review` step
- **Source:** Set in `buildHilComment()` based on `step` and issue count.
- **Used in:** `hil-comment.md`

---

### `{{HIL_INTRO}}`

The introductory sentence explaining why human review is needed.

- **Format:** One or two sentences of Markdown prose.
- **Allowed values:**
  - Non-implement: `` The automated spec gate found **N issue(s)** in the `<step> (N/5)` artifacts that need resolution before proceeding. ``
  - Implement (issues found): `` Resolve the **N issue(s)** below so the pipeline can run the automated **code_review** step. ``
  - Implement (no issues): `` The gate did not auto-advance after implementation. Review the summary, then when ready add a new PR comment whose body is exactly `/proceed` (one line, nothing else). ``
  - Code review: `` The automated **code_review** step has finished. Review `code-review-summary.md` and `.code-review-verdict`, then merge or request changes. ``
- **Source:** Set in `buildHilComment()` based on step type and issue count.
- **Used in:** `hil-comment.md`

---

### `{{SUMMARY}}`

The gate analysis summary text returned by the LLM.

- **Format:** Plain text or Markdown, typically one or two sentences.
- **Source:** `result.summary` from `interpretGateCodexOutput()` in `analyze-spec.ts`.
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
what to do next.

- **Allowed values:**
  - Code review: `\n---\n_Address review findings or merge when ready._`
  - Implement (with issues): footer instructs fixing issues, then adding a **new PR comment** whose body is exactly the one line `/proceed` (continues to **code_review**).
  - Implement (no issues) and non-implement HIL: footer instructs adding a **new PR comment** whose body is exactly the one line `/proceed` to continue the pipeline.
- **Source:** Set in `buildHilComment()` based on step type.
- **Used in:** `hil-comment.md`

---

## Templates

### `pr-comment-proceed.md`

**Purpose:** Posted to the PR when the gate passes (after a successful
`workflow_dispatch` of `speckit-developer-agent-proceed.yml`). The hidden HTML comment
(`<!-- speckit-gate: proceed -->`) is for downstream tooling that scans PR bodies.

**Placeholders:** `{{STEP_LABEL}}`, `{{SUMMARY_BLOCK}}`

**Example output (with summary):**
```markdown
### Spec gate passed

Validation for **`clarify (2/5)`** completed successfully. **No blocking issues** were found in the spec artifacts.

The **next pipeline step** has been triggered: **Developer Agent — Proceed** should appear in the Actions tab for this repository shortly.

<!-- speckit-gate: proceed -->

_All acceptance criteria are clearly defined and unambiguous._
```

**Example output (no summary):** same as above but without the final italic line.

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
When you have addressed the findings above, add a **new PR comment** whose body is exactly this one line:

/proceed

This continues the pipeline.
```

---

## How templates are loaded

```ts
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';

const PROCEED_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'pr-comment-proceed.md');
const HIL_TEMPLATE     = loadTemplate(import.meta.url, 'templates', 'pr-comment-hil.md');

const comment = fillTemplate(PROCEED_TEMPLATE, {
  STEP_LABEL:    stepLabel(step),   // e.g. "clarify (2/5)"
  SUMMARY_BLOCK: summary ? `\n_${summary}_` : '',
}).trim();
```

Both builders call `.trim()` on the result to strip any trailing blank lines
that would appear when optional placeholders (e.g. `{{SUMMARY_BLOCK}}`,
`{{ISSUES_SECTION}}`, `{{HIL_FOOTER}}`) resolve to empty strings.
