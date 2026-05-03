# AI Teammate Templates

These templates produce the GitHub issue body, title, progress comments, and
Copilot agent instructions created by the AI Teammate workflow.

Placeholders follow the `{{PLACEHOLDER_NAME}}` convention and are filled at
runtime by `fillTemplate(template, vars)` from `src/lib/template-utils.ts`.

---

## Placeholder reference

### `{{ISSUE_KEY}}`

The Jira issue key that triggered the workflow.

- **Format:** `<PROJECT>-<NUMBER>` — e.g. `PROJ-123`
- **Source:** `RunnerContext.issueKey` (set from the `JIRA_ISSUE_KEY`
  environment variable when the workflow starts)
- **Used in:** all templates below except `github-issue-with-copilot.md`
  placeholders that have their own dedicated entries

---

### `{{DIRECTIVE_PART}}`

An optional global directive prepended to every spec-kit step input so
that project-wide rules are always included in the Copilot prompt.

- **Format:** `<directive text> — ` (note the trailing ` — ` separator) when
  a directive is configured, or an **empty string** when none is set.
- **Source:** `globalDirective` field in `config/spec-kit/defaults.json` in
  the consumer repository. If the file is missing or the field is absent the
  value is silently set to `""`.
- **Used in:** `github-issue-with-copilot.md`

---

### `{{JIRA_CONTEXT}}`

The full contents of the `issueContext.md` file produced by the spec-kit
pipeline's context-preparation step. Contains the Jira ticket summary,
description, acceptance criteria, and any related-issue summaries.

- **Format:** Markdown prose (multi-line).
- **Source:** `ctx.specKitContextFile` — the absolute path written by
  `prepareSpecKitWorkspace` (`src/workflows/ai-teammate/spec-kit/pipeline.ts`).
  If the file cannot be read the value falls back to `""`.
- **Used in:** `github-issue-with-copilot.md`

---

### `{{SPECIFY_INPUT}}` / `{{CLARIFY_INPUT}}` / `{{PLAN_INPUT}}` / `{{TASKS_INPUT}}` / `{{IMPLEMENT_INPUT}}`

The per-step instruction text produced by the Business Analyst agent. Each
value is the prompt that will be passed to Copilot when that spec-kit step
runs.

- **Format:** Plain text or Markdown, typically one paragraph.
- **Source:** Fields on `BaOutcome.result` (`specifyInput`, `clarifyInput`,
  `planInput`, `tasksInput`, `implementInput`). Falls back to the literal
  string `{TBD}` when the BA did not produce a value for that step.
- **Used in:** `github-issue-with-copilot.md`

---

## Templates

### `github-issue-placeholder.md`

**Purpose:** Initial body set on the GitHub issue immediately after it is
created, before BA analysis finishes. Signals that work is in progress.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `ai-teammate-agent.ts` → `deps.createGithubIssue`

---

### `github-issue-title.md`

**Purpose:** Title of the GitHub issue created for the Copilot Coding Agent.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `ai-teammate-agent.ts` → `deps.createGithubIssue`

**Example output:** `PROJ-123: Copilot Coding Agent Task`

---

### `github-issue-with-copilot.md`

**Purpose:** Full GitHub issue body posted when Copilot is assigned. Contains
the Jira context and the per-step spec-kit inputs that drive the entire
pipeline.

**Placeholders:**

| Placeholder | Description |
|---|---|
| `{{ISSUE_KEY}}` | Jira issue key (see above) |
| `{{DIRECTIVE_PART}}` | Optional global directive prefix (see above) |
| `{{JIRA_CONTEXT}}` | Full Jira context markdown (see above) |
| `{{SPECIFY_INPUT}}` | BA-generated specify-step instruction |
| `{{CLARIFY_INPUT}}` | BA-generated clarify-step instruction |
| `{{PLAN_INPUT}}` | BA-generated plan-step instruction |
| `{{TASKS_INPUT}}` | BA-generated tasks-step instruction |
| `{{IMPLEMENT_INPUT}}` | BA-generated implement-step instruction |

**Set by:** `steps/assign-copilot.ts` → `deps.updateGithubIssue`

---

### `ba-started.md`

**Purpose:** GitHub issue comment posted as soon as BA analysis begins, so
observers know the agent is running.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `ai-teammate-codex-ba-prepare.ts` (`codex_ba_prepare_prompt` after `codex_ba_create_github_issue`, before the Codex job; re-exported from `ai-teammate-codex-ba.ts`)

---

### `ba-complete.md`

**Purpose:** GitHub issue comment posted when BA analysis succeeds and all
5 spec-kit fields have been extracted.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `steps/apply-codex-ba-outcome-to-jira-github.ts` (`codex_ba_finish`, after Codex output is interpreted)

---

### `ba-incomplete.md`

**Purpose:** GitHub issue comment posted when BA analysis fails to extract
sufficient requirements. The Jira ticket is moved to Blocked and the GitHub
issue is closed.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `steps/apply-codex-ba-outcome-to-jira-github.ts` (`codex_ba_finish`, after Codex output is interpreted)

---

### `../prompts/copilot-agent-instructions.md`

**Purpose:** The `agentInstructions` string sent to the Copilot Coding Agent
alongside the GitHub issue assignment. Instructs Copilot on PR naming and
label conventions.

**Placeholders:** `{{ISSUE_KEY}}`

**Set by:** `steps/assign-copilot.ts` → `deps.updateGithubIssue`

**Example output:**
```
When opening the PR, add the label 'jira:PROJ-123' to it.
Include 'PROJ-123' in the PR title prefix (e.g., 'PROJ-123: <description>').
```

---

## How templates are loaded

Files in this directory are loaded relative to their **caller's** location
using `import.meta.url`:

```ts
import { loadTemplate, fillTemplate } from '../../../lib/template-utils.js';

const TEMPLATE = loadTemplate(import.meta.url, '..', 'templates', 'ba-started.md');
//                                                   ^^^
//                          one level up because callers live in steps/

const output = fillTemplate(TEMPLATE, { ISSUE_KEY: ctx.issueKey });
```

`github-issue-with-copilot.md` is loaded differently — via `process.cwd()` —
because it lives in the consumer repository's working directory at
`.sdlc-agents/src/workflows/ai-teammate/templates/`.
