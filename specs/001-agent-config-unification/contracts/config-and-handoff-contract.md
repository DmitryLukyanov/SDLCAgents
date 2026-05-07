# Contracts: Config + Handoff (artifact-only)

This document describes the **external** contracts that must remain stable for consumer repositories:

1. **Agent configuration contracts** (JSON shape conventions)
2. **Async handoff contracts** between parent and child workflows (artifact-only)
3. **Workflow dispatch contracts** (allowed `workflow_dispatch` inputs)

## 1) Agent configuration contract (high level)

This repo supports multiple config “kinds”:

- **Rule-based routers** (example: Scrum Master): top-level `{ "rules": [...] }`
- **Pipeline agents**: top-level `{ "name": "...", "params": { "runner": "pipeline", "steps": [...] }, "model": "..."?, "contracts": { ... } }`

Unified requirements for all kinds:

- Config files MUST be valid JSON.
- A config MUST have a stable identity (path + ref) that is recorded in the GitHub issue snapshot.
- For AI-using agents, config MUST include a single agent-level `model` (no per-step overrides).
- Contracts MUST be declared as reusable named entries, referenced by steps.

## 2) Async handoff contract (artifact-only)

Handoffs between workflows/jobs MUST use **artifacts only**.

- Parent prepares `async-invocation-handoff/<issueKey>/...`
- Parent writes `invocation-handoff-manifest.json` into that directory.
- Child resolves all input/output relative paths from the manifest.

Named contract entries declare:

- `inputParams`: logical key → relative path under the handoff directory
- `outputParams`: logical key → relative path under the handoff directory
- optional `primaryOutputKey`

The system MUST validate:

- manifest contract paths match the declared contract for the step
- required input files exist and are non-empty
- primary output exists on resume

## 3) Workflow dispatch contract

When dispatching a GitHub Actions workflow, the dispatcher MUST only send inputs that the target workflow declares
under `on.workflow_dispatch.inputs`.

If unknown inputs are present, the run MUST fail before dispatch with a clear error message listing:

- workflow file
- provided input keys
- unknown keys (diff)
