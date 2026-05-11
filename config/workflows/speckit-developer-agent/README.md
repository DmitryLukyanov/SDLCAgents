# SpecKit Developer Agent — pipeline config

This folder holds the **agent JSON** consumed by `speckit-developer-agent-codex-prepare.ts` when the consumer repo runs **`_reusable-speckit-developer-agent.yml`**.

## Configuration Structure

The `speckit-developer-agent.config` file uses the following top-level structure:

```json
{
  "name": "<required> agent identifier",
  "description": "<required> short description",
  "params": {
    "runner": "pipeline",
    "model": "o4-mini",
    "ticketContextDepth": 1,
    "branchNamePattern": "feature/{issueKey}-{timestamp}",
    "featureDirPattern": ".specify/features/{issueKey}",
    "draftPR": true,
    "defaultStepInputs": { ... },
    "steps": [ ... ]
  }
}
```

### Required fields

- **`name`** — Agent identifier (used for logging and tracking)
- **`description`** — Brief description of the agent's purpose

### `params` object (pipeline mode)

All agent behaviour is configured inside `params`:

- **`runner`** — Must be `"pipeline"` to use the step-based runner
- **`model`** — AI model for all spec-kit steps (e.g., `"o4-mini"`); defaults to `o4-mini` when omitted everywhere
- **`ticketContextDepth`** — Depth of related Jira tickets to include in context (default: `1`, must be a non-negative integer)
- **`branchNamePattern`** — Template for feature branch names. Supports placeholders:
  - `{issueKey}` — Jira issue key (e.g., `PROJ-123`)
  - `{timestamp}` — Current timestamp in milliseconds
  - Example: `"feature/{issueKey}-{timestamp}"` → `feature/PROJ-123-1234567890`
- **`featureDirPattern`** — Template for feature artifact directory. Supports:
  - `{issueKey}` — Jira issue key
  - Example: `".specify/features/{issueKey}"` → `.specify/features/PROJ-123`
- **`draftPR`** — Whether to create PRs as drafts initially (`true`/`false`)
- **`defaultStepInputs`** — Default prompts for each spec-kit step (currently informational; step prompts are driven by the `<!--sdlc-pipeline-config ...-->` block in the GitHub issue body):
  - `specify` — Initial specification creation
  - `clarify` — Clarification and refinement
  - `plan` — High-level implementation planning
  - `tasks` — Task breakdown
  - `implement` — Implementation execution
  - `code_review` — Code review and validation
- **`steps`** — Array of pipeline step definitions (required in pipeline mode)

### Legacy root-level fields (backward compatibility)

`model`, `ticketContextDepth`, `branchNamePattern`, `featureDirPattern`, `draftPR`, and `defaultStepInputs` may also appear at the root level (outside `params`) for backward compatibility with older configs. When the same field exists in both places, `params` takes precedence.

## How It Works

When the SpecKit Developer Agent runs:

For **specify** when no PR exists yet, CI may run **GitHub bootstrap** first (`speckit-developer-agent-github-bootstrap.ts`): feature branch, draft PR, and initial `speckit-state.json`.

1. **Codex prepare phase** (`speckit-developer-agent-codex-prepare.ts`):
   - Reads the config file from `CONFIG_FILE` environment variable when set
   - Resolves Codex model via `getEffectiveModel`: `params.model` (or root `model`), then `DEVELOPER_MODEL`, legacy `DEVELOPER_AGENT_MODEL`, then `o4-mini`
   - Uses `params.ticketContextDepth` / `TICKET_CONTEXT_DEPTH` env var for Jira context depth
   - For **specify**, branch / PR / feature dir come from `speckit-state.json` (created by GitHub bootstrap); this phase does **not** run git or open PRs. Other steps read the same state file. Values are **not** taken from `branchNamePattern`/`featureDirPattern` in the config at runtime
   - Step prompts are driven by the `<!--sdlc-pipeline-config ...-->` block in the GitHub issue body; `params.defaultStepInputs` is informational and does **not** currently override them

2. **Codex execution** (`_reusable-codex-run.yml`):
   - Runs the spec-kit skill with the configured model

3. **Teardown phase** (`speckit-developer-agent-teardown.ts`):
   - Commits artifacts
   - Updates speckit-state.json
   - Posts PR comments with progress

## Environment Variables (Backward Compatibility)

The config file supports the following environment variable overrides:

- **`DEVELOPER_MODEL`** — Used when `params.model` / root `model` are unset in config
- **`DEVELOPER_AGENT_MODEL`** — Legacy alias for `DEVELOPER_MODEL`
- **`TICKET_CONTEXT_DEPTH`** — Overrides `ticketContextDepth` from config
- **`BRANCH_NAME`** — Overrides dynamic branch name generation (for reuse scenarios)

When `params.model` (or root `model`) is set in the config file, that value is used before repository variables `DEVELOPER_MODEL` / `DEVELOPER_AGENT_MODEL`. If none are set, the default is **`o4-mini`**.

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
  "name": "speckit_developer_agent",
  "description": "SpecKit Developer Agent with custom model",
  "params": {
    "runner": "pipeline",
    "model": "claude-sonnet-4-5",
    "steps": []
  }
}
```

### Customize step prompts
```json
{
  "name": "speckit_developer_agent",
  "description": "SpecKit Developer Agent with custom prompts",
  "params": {
    "runner": "pipeline",
    "defaultStepInputs": {
      "specify": "Create a detailed spec focusing on API design and data models",
      "implement": "Implement with emphasis on test coverage and documentation"
    },
    "steps": []
  }
}
```

### Change directory structure
```json
{
  "name": "speckit_developer_agent",
  "description": "SpecKit Developer Agent with custom paths",
  "params": {
    "runner": "pipeline",
    "featureDirPattern": "specs/{issueKey}",
    "branchNamePattern": "dev/{issueKey}",
    "steps": []
  }
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
  "name": "speckit_developer_agent",
  "description": "SpecKit Developer Agent",
  "params": {
    "runner": "pipeline",
    "model": "claude-sonnet-4-5",
    "ticketContextDepth": 2,
    "steps": []
  }
}
```

And pass it to the workflow:
```yaml
with:
  config_file: config/workflows/speckit-developer-agent/speckit-developer-agent.config
```

Environment variables will still work as overrides if needed for specific runs.
