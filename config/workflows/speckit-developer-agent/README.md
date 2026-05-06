# SpecKit Developer Agent — pipeline config

This folder holds the **agent JSON** consumed by `speckit-developer-agent-setup.ts` when the consumer repo runs **`_reusable-speckit-developer-agent.yml`**.

## Configuration Structure

The `speckit-developer-agent.config` file contains:

- **`name`** — Agent identifier (used for logging and tracking)
- **`description`** — Brief description of the agent's purpose
- **`model`** — Default Codex model for all spec-kit steps (e.g., `"o4-mini"`, `"claude-sonnet-4-5"`)
- **`ticketContextDepth`** — Depth of related Jira tickets to include in context (default: `1`)
- **`branchNamePattern`** — Template for feature branch names. Supports placeholders:
  - `{issueKey}` — Jira issue key (e.g., `PROJ-123`)
  - `{timestamp}` — Current timestamp in milliseconds
  - Example: `"feature/{issueKey}-{timestamp}"` → `feature/PROJ-123-1234567890`
- **`featureDirPattern`** — Template for feature artifact directory. Supports:
  - `{issueKey}` — Jira issue key
  - Example: `".specify/features/{issueKey}"` → `.specify/features/PROJ-123`
- **`draftPR`** — Whether to create PRs as drafts initially (`true`/`false`)
- **`defaultStepInputs`** — Default prompts for each spec-kit step:
  - `specify` — Initial specification creation
  - `clarify` — Clarification and refinement
  - `plan` — High-level implementation planning
  - `tasks` — Task breakdown
  - `implement` — Implementation execution
  - `code_review` — Code review and validation

## How It Works

When the SpecKit Developer Agent runs:

1. **Setup phase** (`speckit-developer-agent-setup.ts`):
   - Reads the config file from `CONFIG_FILE` environment variable
   - Merges config values with environment variables (env vars take precedence for backward compatibility)
   - Uses config to determine model, context depth, and default prompts
   - Creates/updates speckit-state.json with branch and PR information

2. **Codex execution** (`_reusable-codex-run.yml`):
   - Runs the spec-kit skill with the configured model
   - Uses input prompt from setup phase (combines config defaults with step-specific customization)

3. **Teardown phase** (`speckit-developer-agent-teardown.ts`):
   - Commits artifacts
   - Updates speckit-state.json
   - Posts PR comments with progress

## Environment Variables (Backward Compatibility)

The config file supports the following environment variable overrides:

- **`DEVELOPER_AGENT_MODEL`** — Overrides `model` from config
- **`TICKET_CONTEXT_DEPTH`** — Overrides `ticketContextDepth` from config
- **`BRANCH_NAME`** — Overrides dynamic branch name generation (for reuse scenarios)

When both config and env var are present, **env var takes precedence** to support existing workflows.

## Consumer Setup

1. Copy **`speckit-developer-agent.config`** (and this README if you want) into the same path in your repo:
   ```
   config/workflows/speckit-developer-agent/speckit-developer-agent.config
   ```

2. Update your workflow to pass the config file path:
   ```yaml
   jobs:
     call:
       uses: DmitryLukyanov/SDLCAgents/.github/workflows/_reusable-speckit-developer-agent.yml@master
       with:
         mode: speckit
         issue_number: ${{ github.event.issue.number }}
         issue_key: ${{ inputs.issue_key }}
         step: specify
         branch_name: ${{ inputs.branch_name }}
         config_file: config/workflows/speckit-developer-agent/speckit-developer-agent.config
       secrets: inherit
   ```

3. Ensure secrets are configured:
   - `COPILOT_PAT` — GitHub PAT for checkout, setup, push
   - `OPENAI_API_KEY` — API key for Codex
   - `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` — Optional, for Jira integration

## Customization Examples

### Use a different model for all steps
```json
{
  "model": "claude-sonnet-4-5"
}
```

### Customize step prompts
```json
{
  "defaultStepInputs": {
    "specify": "Create a detailed spec focusing on API design and data models",
    "implement": "Implement with emphasis on test coverage and documentation"
  }
}
```

### Change directory structure
```json
{
  "featureDirPattern": "specs/{issueKey}",
  "branchNamePattern": "dev/{issueKey}"
}
```

## Migration from Environment Variables

If you're currently using environment variables in your workflow:

**Before:**
```yaml
env:
  DEVELOPER_AGENT_MODEL: claude-sonnet-4-5
  TICKET_CONTEXT_DEPTH: 2
```

**After:**
Create `config/workflows/speckit-developer-agent/speckit-developer-agent.config`:
```json
{
  "model": "claude-sonnet-4-5",
  "ticketContextDepth": 2
}
```

And pass it to the workflow:
```yaml
with:
  config_file: config/workflows/speckit-developer-agent/speckit-developer-agent.config
```

Environment variables will still work as overrides if needed for specific runs.
