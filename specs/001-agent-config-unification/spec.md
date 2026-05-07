# Feature Specification: Agent Config Unification

**Feature Branch**: `[speckit-review]`  
**Created**: 2026-05-07  
**Status**: Draft  
**Input**: User description: "Unify agent configuration and cross-agent contracts; use GitHub issues as memory; enforce model-in-config for AI steps; standardize artifacts and issue updates; make new agents config-first; fix AI-teammate resume error: unexpected workflow_dispatch inputs [\"config_file\"]."

## Clarifications

### Session 2026-05-07

- Q: Canonical artifact naming (Invocation Inputs) → A: Issue + step: `invocation-inputs_<issueKey>_<stepId>`
- Q: “Model value in config” scope → A: Per-agent only (single agent-level `model`; no per-step overrides)
- Q: Where should agents write “updates” in the GitHub issue? → A: Body + comments (body = latest snapshot; comments = timeline)
- Q: How should “contract configuration in config files” be scoped? → A: Reusable named contracts + step reference
- Q: If GitHub issue updates fail, what should the agent do? → A: Hard fail the run

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure an agent consistently (Priority: P1)

As a platform engineer, I want every agent (Scrum Master, AI Teammate, Business Analyst, Developer Agent, gates, and future agents) to be configured through a unified configuration approach so that behavior is predictable and onboarding to consumer repos is straightforward.

**Why this priority**: Configuration-driven behavior is the platform’s main extension surface; inconsistencies quickly break consumers and block new agent rollout.

**Independent Test**: Choose one existing agent and prove its config can be read/validated using the same rules as other agents, and that an invalid config fails fast with a clear error.

**Acceptance Scenarios**:

1. **Given** an agent config file with required keys present, **When** the pipeline starts that agent, **Then** the agent runs using only values from the config for routing rules, step ordering, and model selection (where applicable).
2. **Given** an agent config file missing a required key, **When** the pipeline starts that agent, **Then** the run fails early with an actionable error that points to the exact missing/invalid field.

---

### User Story 2 - Use GitHub issues as durable memory and history (Priority: P1)

As an operator (or developer), I want each agent run to use the GitHub issue as the durable record of context, progress, and outcomes, so that re-runs and handoffs (including resumes) have a single place to read and write history.

**Why this priority**: The GitHub issue is the most accessible shared state across jobs and users; using it consistently reduces “lost context” and improves human-in-the-loop control.

**Independent Test**: Run an agent for a single ticket and verify that the issue contains enough structured history to understand what happened without reading workflow logs.

**Acceptance Scenarios**:

1. **Given** an issue created/linked for a ticket, **When** an agent starts, **Then** it appends an update to the issue describing the start event, inputs, and the config identity used.
2. **Given** an agent completes (success or stop), **When** it finishes, **Then** it appends a completion update including outputs (links to artifacts) and a clear next action for humans or automation.

---

### User Story 3 - Exchange data between agents via artifacts + contract config (Priority: P1)

As a platform engineer, I want agents to communicate via uploaded artifacts and a declarative contract defined in config, so that cross-agent handoffs are reproducible, validated, and runner-agnostic.

**Why this priority**: It reduces ad-hoc workflow inputs and prevents fragile coupling. It also makes it feasible to add new agents/steps without rewriting orchestration.

**Independent Test**: Execute a two-agent handoff and validate that the child agent can run using only the contract-defined artifact bundle and issue history, with no hidden assumptions.

**Acceptance Scenarios**:

1. **Given** a parent step with a declared contract, **When** it hands off to a child workflow, **Then** the parent uploads an artifact bundle whose filenames match the contract and records the artifact identity in the GitHub issue update.
2. **Given** a child workflow resumes or starts from a handoff, **When** it begins execution, **Then** it validates that the contract matches what was declared and fails with a clear “contract drift” message if it does not.

---

### User Story 4 - Add a new agent by authoring config first (Priority: P2)

As a platform engineer, I want to add a new agent by creating a config file that declares rules, steps, contracts, and models—even if some step implementations do not exist yet—so the platform can validate the design and show what remains to be implemented.

**Why this priority**: The platform should scale to many agents without forcing immediate code changes, and should make missing operations explicit work items.

**Independent Test**: Add a “stub” agent config with one unimplemented step runner; verify the system reports the missing runner clearly and suggests where to implement it.

**Acceptance Scenarios**:

1. **Given** a new agent config that references a step runner that is not implemented, **When** the pipeline loads the config, **Then** it reports the missing runner and stops without partial side effects.
2. **Given** the same agent config after the runner is implemented, **When** the pipeline runs, **Then** it executes the new runner without requiring changes to unrelated agents.

---

### User Story 5 - Fix AI Teammate resume dispatch failure (Priority: P1)

As an operator, I want AI Teammate to reliably dispatch the Developer Agent during resume or handoff flows without failing due to mismatched workflow inputs, so that automated ticket progression works end-to-end.

**Why this priority**: The reported 422 failure blocks the pipeline and prevents continued automation.

**Independent Test**: Trigger the same resume/handoff flow that previously failed and confirm the dispatch succeeds.

**Acceptance Scenarios**:

1. **Given** AI Teammate dispatches the Developer Agent workflow, **When** it sends `workflow_dispatch` inputs, **Then** all inputs are accepted by the target workflow and the dispatch does not return HTTP 422.
2. **Given** a config-driven change to dispatch inputs, **When** that change is introduced, **Then** the system detects incompatibility (invalid input keys) before dispatch (or fails with an explicit mapping error).

### Edge Cases

- What happens when a GitHub issue is missing (deleted, permissions, or API failure) but the agent requires issue memory updates?
- What happens when a child agent artifact bundle exists but is incomplete (missing required contract file, empty file, wrong path)?
- What happens when a config defines a contract that conflicts with an existing deployed workflow’s accepted inputs?
- What happens when multiple agents write updates concurrently to the same GitHub issue (ordering, idempotency, duplication)?
- What happens when a config references a named contract that does not exist?
- What happens when a step references a contract and applies overrides that conflict with the named contract?
- What happens when the invocation inputs artifact cannot be uploaded (but GitHub issue updates are mandatory)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a unified, documented configuration approach for all agents (rules, steps, contracts, and per-agent knobs) that is consistent across existing agents and future additions.
- **FR-002**: System MUST support configuring each agent’s routing rules via config (for example “which tickets to pick up” and “which workflow/config to dispatch next”), with consistent field names and validation rules.
- **FR-003**: System MUST use the GitHub issue as durable memory by writing (a) a latest structured snapshot in the issue **body** and (b) chronological run history as issue **comments**, including links/identifiers to any artifacts produced.
- **FR-004**: System MUST support cross-agent communication via GitHub artifacts plus a declarative, reusable contract defined in config (named contracts referenced by steps), and MUST validate the contract at handoff and resume boundaries.
- **FR-005**: Each agent that uses an AI model MUST define a single agent-level `model` value in its config (no per-step overrides), and the effective model used MUST be recorded in the issue history.
- **FR-006**: System MUST upload the agent’s input arguments (the canonical “invocation inputs” for a run/step) into a GitHub artifact with canonical name `invocation-inputs_<issueKey>_<stepId>`.
- **FR-007**: System MUST make creating a new agent “config-first”: a new config can be introduced without changing unrelated code; missing step runners MUST be surfaced as explicit, actionable errors.
- **FR-008**: System MUST prevent dispatching GitHub workflows with unexpected `workflow_dispatch` inputs; dispatch payloads MUST match the target workflow input schema.
- **FR-009**: If the agent cannot write required GitHub issue updates (body snapshot or timeline comment), the run MUST fail with an actionable error explaining what operation failed and why.
- **FR-010**: The unified configuration approach MUST explicitly support two config kinds:
  - **Router configs**: top-level non-empty `rules[]`; each rule MUST include at minimum a dispatch target (`configFile`, `workflowFile` or equivalent) and selection criteria where applicable (e.g. `jql` for Jira-driven routers).
  - **Pipeline agent configs**: top-level `name`, `description`, non-empty `params.steps[]`, optional `contracts{}`, and required `model` when the agent uses an AI model.
- **FR-011**: System MUST validate config files and fail fast with a single, actionable error that includes: config path, config kind, and the exact invalid/missing field(s).
- **FR-012**: System MUST define and record a **config identity** in GitHub issue updates: `{ config_file_path, workflow_ref (or equivalent version identifier) }`.
- **FR-013**: System MUST define `stepId` as the stable step identifier from configuration (`steps[].id`, or a deterministic default if omitted) and MUST use it consistently for resume correlation and canonical artifact naming.
- **FR-014**: Shared plumbing MUST remain reusable across agents (no per-agent forks without justification): config parsing/validation, routing/dispatch payload building, workflow dispatch input validation, contract validation, and issue memory writes.
- **FR-015**: “Unique agent functionality” MUST be limited to implementing new step runners/operations and their domain-specific side effects; introducing a new agent MUST NOT require duplicating routing/dispatch/config parsing logic.
- **FR-016**: For dispatch input validation failures, the error reported in the GitHub issue timeline MUST list: target workflow, provided input keys, and the rejected/unknown keys.
- **FR-017**: If a config references a named contract that does not exist, the run MUST fail during config validation and the error MUST name the missing contract key.
- **FR-018**: If step-level contract overrides create a conflict with the named contract (e.g., invalid path, unsafe path, or ambiguous primary output), the run MUST fail during validation with a “contract override conflict” error.
- **FR-019**: If uploading the invocation inputs artifact fails, the run MUST fail and MUST still attempt to write a final GitHub issue update describing the failure (unless GitHub issue updates also fail, in which case FR-009 governs).
- **FR-020**: Requirements MUST explicitly prohibit writing secrets to GitHub issues or artifacts. Any issue/artefact updates MUST be limited to non-secret metadata, links, and safe excerpts.
- **FR-021**: On resume or retry after async handoff, the effective config file, named contracts, and `stepId` correlation MUST match the run that produced the stored handoff artifacts; otherwise the run MUST fail with an explicit config or handoff mismatch error (in addition to contract drift detection in FR-004).
- **FR-022**: Operator-visible issue updates (body snapshot and timeline comments) MUST include enough context to identify the active **config kind**, **config file path**, and **step** when reporting parsing, validation, or dispatch outcomes; for dispatch validation failures, FR-016 applies.
- **FR-023**: Within a single pipeline agent config, step identifiers MUST be unique after applying FR-013 defaults; duplicate ids MUST fail validation per FR-011 so canonical artifact names `invocation-inputs_<issueKey>_<stepId>` cannot collide within one agent run.

### Key Entities *(include if feature involves data)*

- **Agent Config**: A file that defines how an agent runs (rules, steps, contracts, and parameters).
- **Rule**: A selection/routing entry that chooses which ticket(s) to process and which workflow/config to invoke.
- **Step**: An ordered unit of work within an agent pipeline; may include an async boundary and an artifact contract.
- **Contract**: A declarative mapping of logical input/output names to artifact file paths for handoff/resume.
- **Invocation Inputs Artifact**: A canonical artifact containing the inputs used to run an agent/step (arguments, derived context pointers, and config identity).
- **Issue Memory Entry**: A structured update written to the GitHub issue documenting progress, outcomes, and links to artifacts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly added agent config with at least one step can be validated and either executed or rejected with a precise error (missing/invalid fields or missing runner) within 1 minute of starting the workflow.
- **SC-002**: For any agent run, an operator can understand the run’s inputs, progress, outputs, and next actions by reading the GitHub issue alone (without logs) in under 3 minutes.
- **SC-003**: Cross-agent handoff failures are diagnosable from the issue + artifact bundle (clear “contract drift/missing artifact” messages) with no silent failures.
- **SC-004**: AI Teammate → Developer Agent dispatch succeeds for the “resume/handoff” scenario that previously returned HTTP 422, and does not regress in repeated runs.
- **SC-005**: Adding a new agent that reuses existing routing/dispatch/config parsing requires implementing only new step runners (no new dispatch/parsing variants) and results in at most one new config file plus operation code.

## Assumptions

- GitHub Issues are available and permitted for the consumer repos using these agents, and can be used as the durable history store for runs.
- GitHub Actions artifacts are available and are the primary mechanism for transferring structured data between workflows/jobs.
- Agent behavior is intended to be driven primarily through `config/workflows/**` files, consistent with the repository’s stated goals.
- The platform will continue to support human-in-the-loop interaction where needed (issue comments and PR comments remain the primary control surface).
- GitHub Actions artifacts are assumed **never to expire** for the lifetime of the workflows that reference them; durable operator narrative and correlation still remain in the GitHub issue per FR-003, but artifact links are not treated as time-limited by this specification.
