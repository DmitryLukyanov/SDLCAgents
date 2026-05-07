# Quickstart: Agent Config Unification (dev + validation)

This feature improves the existing SDLCAgents pipeline by:

- unifying agent configuration conventions
- enforcing artifact-only contracts for cross-agent communication
- requiring GitHub issue updates as durable memory
- fixing and hardening workflow dispatch input compatibility

## Verify current baseline

- Confirm existing configs load:
  - `config/workflows/scrum-master/scrum-master.config`
  - `config/workflows/ai-teammate/ai-teammate.config`
  - `config/workflows/speckit-developer-agent/speckit-developer-agent.config`
- Confirm handoff contract utilities exist:
  - `src/lib/agent-invocation-contract.ts`
  - `src/lib/invocation-handoff.ts`

## Reproduce the known failure (for regression test)

Target: AI Teammate dispatches `speckit-developer-agent.yml` and must not send unknown `workflow_dispatch` inputs.

Expected prior failure symptom:

- HTTP 422 with message: `Unexpected inputs provided: ["config_file"]`

## Success signal after the fix

- Dispatch succeeds (no 422)
- GitHub issue receives:
  - updated body snapshot (latest state)
  - comment timeline entry for dispatch and for completion
- Invocation inputs artifact exists with canonical name:
  - `invocation-inputs_<issueKey>_<stepId>`

## Validation gates (high level)

- Config validation runs before execution:
  - required fields present
  - contracts referenced by steps exist
  - AI-using agent has a single `model`
- Contract validation runs at handoff and resume boundaries.
- Workflow dispatch validation runs before dispatch.
