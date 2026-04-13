## Spec-Kit Workflow for {{ISSUE_KEY}}

### Jira Ticket Context

{{JIRA_CONTEXT}}

### Pipeline Configuration

Step inputs for the controller — do not modify this block.

```json
{
  "specifyInput": "{{DIRECTIVE_PART}}{{SPECIFY_INPUT}}",
  "clarifyInput": "{{DIRECTIVE_PART}}{{CLARIFY_INPUT}}",
  "planInput": "{{DIRECTIVE_PART}}{{PLAN_INPUT}}",
  "tasksInput": "{{DIRECTIVE_PART}}{{TASKS_INPUT}}",
  "implementInput": "{{DIRECTIVE_PART}}{{IMPLEMENT_INPUT}}"
}
```

### Instructions

Run the spec-kit pipeline **one step at a time** using the step controller.

**On initial assignment** — start the pipeline:

```
@speckit.step-controller
```

**When `@copilot proceed` is typed in the PR** — continue to the next step:

```
@speckit.step-controller
```

The step controller reads `speckit-state.json` from the feature directory to determine which step to run next. After each step it posts a summary comment to the PR with instructions for continuing.

Commit all generated artifacts. Do not open a PR manually — the Copilot runtime handles this.
