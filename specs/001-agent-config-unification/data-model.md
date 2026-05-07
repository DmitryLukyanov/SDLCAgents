# Data Model: Agent Config Unification

This feature is primarily configuration and orchestration focused. The “data model” is the set of durable artifacts
and config entities that define agent behavior and cross-agent communication.

## Entities

### AgentConfig

Represents one agent’s configuration file.

- **name**: stable identifier for the agent (`scrum_master`, `ai_teammate`, etc.)
- **description**: human-readable summary
- **model** (optional, depending on agent): single LLM model identifier for AI-using agents (per FR-005)
- **params** / **rules**: agent-specific top-level configuration (see below)
- **contracts**: reusable named contracts (per clarification)

### Rule

Routing configuration that selects tickets and dispatches a workflow + config.

- **description**
- **jql** (for Jira-driven agents)
- **requiredJiraStatus** / **postReadStatus**
- **configFile**: agent config path to run
- **workflowFile** / **workflowRef**: entry workflow dispatch target
- **limit**
- **skipIfLabel** / **addLabel**

### PipelineStep

One ordered step executed by a pipeline agent.

- **id**: stable identifier for resume and async correlation
- **runner**: operation name
- **enabled**
- **async_call** (optional): child workflow dispatch spec
- **contractRef** (recommended): reference to a named contract (plus optional overrides)

### NamedContract

Reusable contract describing cross-job/workflow artifact paths.

- **inputParams**: map logical key → relative artifact path
- **outputParams**: map logical key → relative artifact path
- **primaryOutputKey** (optional): designates which output is the “primary” output

### InvocationInputsArtifact

Canonical artifact containing the inputs used for a run/step.

- **artifactName**: `invocation-inputs_<issueKey>_<stepId>` (per clarification)
- **payload**: the arguments and derived identifiers needed to reproduce/diagnose the run

### IssueSnapshot

The latest structured snapshot stored in the GitHub issue body (per clarification).

- **config identity** (which config file + version/ref)
- **current step / status**
- **links to key artifacts**

### IssueTimelineEntry

Append-only issue comment entries that form the timeline (per clarification).

- **start** / **progress** / **completion** events
- **artifact links**
- **error diagnostics** (including “contract drift” / missing artifacts / dispatch incompatibility)

## Identity & Uniqueness Rules

- `PipelineStep.id` must be stable across retries/resume for the same config file.
- The invocation inputs artifact name must be unique at least per `(issueKey, stepId)`.

## Lifecycle / State Transitions

- **Prepare → Dispatch → Resume** for async steps:
  - Prepare phase writes contract files + manifest into the handoff workspace.
  - Dispatch phase launches the child workflow.
  - Resume phase validates the manifest matches the step’s declared contract and checks primary output exists.
