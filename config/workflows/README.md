# Workflow agent configs

JSON files under `config/workflows/<agent>/` define **router** or **pipeline agent** configurations (see feature spec FR-010).

## Kinds

- **Router** (e.g. Scrum Master): top-level non-empty `rules[]` with `jql`, `configFile`, optional `workflowFile` / `workflowRef`.
- **Pipeline agent**: top-level `name`, `description`, `params.steps[]`, optional top-level `contracts{}`. AI-using pipelines require a **single** agent-level `model` (top-level or `params.model`).

## Named contracts

Optional top-level `contracts` maps reusable invocation contracts. Async steps may set `contractRef` to a key in that map and optional inline `contract` overrides (see `src/lib/agent-invocation-contract.ts`).

## Dispatch

Child workflows must receive only inputs declared on `on.workflow_dispatch.inputs` in the target YAML. Validation uses `src/lib/workflow-dispatch-inputs-registry.ts` (keep aligned with `.github/workflows/*.yml`).
