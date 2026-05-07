# Feature Specification: Agent Config Unification

**Feature Branch**: `[speckit-review]`  
**Created**: 2026-05-07  
**Status**: Draft  
**Input**: User description: "Unify agent configuration and cross-agent contracts; use GitHub issues as memory; enforce model-in-config for AI steps; standardize artifacts and issue updates; make new agents config-first; fix AI-teammate resume error: unexpected workflow_dispatch inputs [\"config_file\"]."

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

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a unified, documented configuration approach for all agents (rules, steps, contracts, and per-agent knobs) that is consistent across existing agents and future additions.
- **FR-002**: System MUST support configuring each agent’s routing rules via config (for example “which tickets to pick up” and “which workflow/config to dispatch next”), with consistent field names and validation rules.
- **FR-003**: System MUST store run history and progress updates in the GitHub issue for the ticket, including links/identifiers to any artifacts produced.
- **FR-004**: System MUST support cross-agent communication via GitHub artifacts plus a declarative contract defined in config (inputs/outputs), and MUST validate the contract at handoff and resume boundaries.
- **FR-005**: Each agent step that uses an AI model MUST have a model value in config (directly or via a consistent override mechanism), and the effective model used MUST be recorded in the issue history.
- **FR-006**: System MUST upload the agent’s input arguments (the canonical “invocation inputs” for a run/step) into a GitHub artifact with a canonical name that uniquely identifies it for the run and step.
- **FR-007**: System MUST make creating a new agent “config-first”: a new config can be introduced without changing unrelated code; missing step runners MUST be surfaced as explicit, actionable errors.
- **FR-008**: System MUST prevent dispatching GitHub workflows with unexpected `workflow_dispatch` inputs; dispatch payloads MUST match the target workflow input schema.

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

## Assumptions

- GitHub Issues are available and permitted for the consumer repos using these agents, and can be used as the durable history store for runs.
- GitHub Actions artifacts are available and are the primary mechanism for transferring structured data between workflows/jobs.
- Agent behavior is intended to be driven primarily through `config/workflows/**` files, consistent with the repository’s stated goals.
- The platform will continue to support human-in-the-loop interaction where needed (issue comments and PR comments remain the primary control surface).
