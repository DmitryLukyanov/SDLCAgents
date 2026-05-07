# Research: Agent Config Unification

**Date**: 2026-05-07  
**Spec**: `specs/001-agent-config-unification/spec.md`  
**Plan**: `specs/001-agent-config-unification/plan.md`

## Existing baseline (current repo behavior)

- **Config-driven routing exists**:
  - `config/workflows/scrum-master/scrum-master.config` routes Jira tickets to an entry workflow + agent config.
  - `config/workflows/ai-teammate/ai-teammate.config` defines a pipeline with ordered steps and an async boundary.
- **Artifact-only async contract exists (parent ↔ child)**:
  - The contract shape is already implemented in TypeScript (`src/lib/agent-invocation-contract.ts`) and validated
    by composed helpers (`src/lib/invocation-handoff.ts`).
  - The Business Analyst async workflow already follows “artifact-only invocation”: it resolves prompt/output paths
    from a manifest file inside the handoff artifact bundle.
- **GitHub issue is already used as history/memory** in parts of the pipeline (Jira snapshot in issue body, BA updates
  and pipeline summaries as comments in some flows).

## Key problems to solve (from spec)

### 1) “Unified config approach” gaps

Decision: Standardize config conventions across agents into a single, documented schema family.

Rationale: Today there are at least two top-level shapes (`rules[]` for scrum-master and `params.steps[]` for pipeline
agents). This is fine, but “unified” needs explicit rules: shared field names, shared validation, and shared conventions
for contracts, models, and canonical artifacts.

Alternatives considered:
- Force one universal config shape for every agent (rejected: would make scrum-master and pipeline configs awkward).
- Keep everything ad-hoc per agent (rejected: blocks “config-first new agent” and contract reuse).

### 2) GitHub issue as mandatory memory surface

Decision: Treat GitHub issue updates as required; fail run if cannot write required updates (per FR-009).

Rationale: The spec locks this in; it also matches operational expectations for SDLC flows where humans depend on the
issue as the single durable story.

Alternatives considered:
- Degrade-but-continue on issue write failures (rejected per clarification).

### 3) Reusable named contracts

Decision: Define contracts under a top-level `contracts` map in config; steps reference by name; allow step-level
overrides only for paths that must differ.

Rationale: Matches the existing “artifact-only” contract implementation and improves reuse across agents/steps.

Alternatives considered:
- Step-only contracts everywhere (rejected: duplication and drift risk).
- Single global contract everywhere (rejected: too rigid for multi-agent evolution).

### 4) Terminal workflow dispatch input mismatch (AI Teammate → Developer Agent)

Decision: Ensure dispatch inputs match the target workflow’s declared `workflow_dispatch.inputs`. Add pre-dispatch
validation that rejects unknown keys before calling GitHub.

Rationale: The observed failure is an HTTP 422 “Unexpected inputs provided: [config_file]”. This is a contract mismatch
between dispatcher code and the target workflow definition.

Alternatives considered:
- Ignore unknown keys / rely on GitHub to reject (rejected: leads to broken runs).

## Practical implications for planning

- The plan must produce a **config schema reference** (contracts, models, canonical artifacts).
- The plan must include a **dispatch-input compatibility check** for workflow dispatches.
- The plan should describe how to keep **step-by-step validation** for the SpecKit developer agent and still remain
  agent-agnostic (Codex is invoked via `openai/codex-action@v1`, but orchestration should allow other runners later).
