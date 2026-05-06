
---

## Pipeline Execution Context

You are running inside a **GitHub Actions pipeline** (non-interactive / headless mode).
Apply the following overrides to the agent instructions above:

- **Feature directory**: `{{FEATURE_DIR}}` — write ALL output files into this directory.
- **$ARGUMENTS**: `{{INPUT}}` — use this as the feature description / user input.
- **Non-interactive**: Never pause for user input. Make sensible default choices automatically.
- **Skip PowerShell setup scripts**: `create-new-feature.ps1`, `setup-plan.ps1`, and
  `check-prerequisites.ps1` have already been executed by the pipeline — do NOT call them.
- **No git operations**: Do NOT create branches, commits, or push — the pipeline manages git.
- **Resolve [NEEDS CLARIFICATION] markers**: Use reasonable defaults rather than asking.
