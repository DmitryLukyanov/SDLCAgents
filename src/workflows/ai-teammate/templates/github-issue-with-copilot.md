## Spec-Kit Workflow for {{ISSUE_KEY}}

### Jira Ticket Context

{{JIRA_CONTEXT}}

### Instructions

Run the spec-kit steps below **in order**. Execute each `@speckit.*` command before moving to the next; do not skip phases or replace this flow with ad-hoc exploration alone.

Each line is `@speckit.*` followed by one quoted argument: when a global directive is configured it appears first, then an em dash, then the step text (suitable to pass as a single argument after the agent name).

1. `@speckit.specify` "{{DIRECTIVE_PART}}{{SPECIFY_INPUT}}"
2. `@speckit.clarify` "{{DIRECTIVE_PART}}{{CLARIFY_INPUT}}"
3. `@speckit.plan` "{{DIRECTIVE_PART}}{{PLAN_INPUT}}"
4. `@speckit.tasks` "{{DIRECTIVE_PART}}{{TASKS_INPUT}}"
5. `@speckit.implement` "{{DIRECTIVE_PART}}{{IMPLEMENT_INPUT}}"

The feature spec has been seeded in the `specs/` directory.
Commit all generated artifacts and open a PR when done.
