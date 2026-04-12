---
name: "speckit-code_review"
description: "Automated code review after implementation — validate changes against spec/tasks, fix clear issues, write verdict artifacts."
compatibility: "Runs after speckit-implement on the same feature branch"
metadata:
  author: "SDLCAgents"
---

## User input

```text
$ARGUMENTS
```

If non-empty, treat it as extra review focus (risks, files, or acceptance criteria). If empty, use the default scope below.

## Objective

You are the **code-review** pipeline step (Codex in CI). The implementation step has finished; your job is to:

1. Read **`spec.md`**, **`plan.md`**, and **`tasks.md`** in the current feature/spec directory (same tree used by earlier speckit steps).
2. Inspect **source and test changes** on this branch (use the repo layout — e.g. `src/`, `tests/`).
3. **Fix** straightforward problems (bugs, missing headers per team rules, obvious test gaps) when safe.
4. Write **review artifacts** so humans and automation can see the outcome.

## Outputs (required)

Write under the **repository root** (not only inside the feature folder) so teardown always stages them:

| File | Purpose |
|------|---------|
| `code-review-summary.md` | Markdown summary: requirements table, code-quality checks, verdict section |
| `.code-review-verdict` | Single line: exactly `APPROVED` or `CHANGES_NEEDED` |

Optional: `code-review-comments.json` — JSON array of `{ "path", "line", "body" }` for notable findings (same idea as the `code.review` GitHub agent).

## Summary format

`code-review-summary.md` must end with a line:

```markdown
### Overall verdict: APPROVED
```

or `CHANGES_NEEDED`, matching `.code-review-verdict`.

## Constraints

- **Do not** run `git push` — the SDLC workflow commits and pushes.
- Prefer **small, focused edits**; do not rewrite unrelated modules.
- If the repo has no tests or you cannot run them, say so in the summary — do not invent results.

## Reference

Align spirit with `.github/agents/code.review.agent.md` (requirements mapping, quality checks), adapted for non-interactive Codex execution.
