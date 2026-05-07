---

description: "Task list for Agent Config Unification feature implementation"
---

# Tasks: Agent Config Unification

**Input**: Design documents from `/specs/001-agent-config-unification/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec.md for TDD; validation is via `npm run check`, config/load checks, and `quickstart.md` scenarios.

**Organization**: Tasks are grouped by user story. User Story 5 (P1 dispatch fix) is scheduled after shared validation (Foundational) and handoff surfaces; User Story 4 (P2) follows P1 stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single TypeScript repo: `src/`, `config/workflows/`, `.github/workflows/`, `tests/` at repository root (per `specs/001-agent-config-unification/plan.md`).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification and inventory before changing shared plumbing.

- [x] T001 Verify baseline per `specs/001-agent-config-unification/quickstart.md` using listed configs (`config/workflows/scrum-master/scrum-master.config`, `config/workflows/ai-teammate/ai-teammate.config`, `config/workflows/speckit-developer-agent/speckit-developer-agent.config`) and libs (`src/lib/agent-invocation-contract.ts`, `src/lib/invocation-handoff.ts`)
- [x] T002 [P] Run `npm run check` at repository root (`package.json`) and record any pre-existing failures to distinguish from regressions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, dispatch compatibility, issue memory, and artifact naming used by all user stories.

**⚠️ CRITICAL**: No user story work should proceed until this phase completes.

- [x] T003 Add config-kind detection (router vs pipeline agent) and unified validation error formatting (config path, kind, invalid/missing fields) in new module `src/lib/agent-config-validate.ts` and export for callers
- [x] T004 [P] Enforce unique step ids after normalization (FR-023) with actionable errors in `src/lib/pipeline-config.ts`
- [x] T005 [P] Validate top-level named `contracts` exist for each `contractRef`, and detect step override conflicts (FR-017, FR-018) in `src/lib/agent-invocation-contract.ts` with helpers callable from config load
- [x] T006 Implement pre-dispatch workflow input validation (allowed keys vs payload; FR-008, FR-016) in new module `src/lib/workflow-dispatch-validate.ts`, sourcing allowed inputs from target workflow YAML under `.github/workflows/` (e.g. `speckit-developer-agent.yml`) or an explicit registry file co-located in `src/lib/` if YAML parsing in runtime is not viable
- [x] T007 Add shared GitHub issue memory helpers (body snapshot + timeline comments, hard-fail on required write failures per FR-009) in new module `src/lib/issue-memory.ts`
- [x] T008 Add canonical invocation inputs artifact name helper `invocation-inputs_<issueKey>_<stepId>` (FR-006) in new module `src/lib/invocation-inputs-artifact.ts` for upload/download call sites

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Configure an agent consistently (Priority: P1) 🎯 MVP

**Goal**: One unified validation path for router and pipeline agent configs; invalid configs fail fast with clear, field-level errors (FR-001, FR-002, FR-005, FR-010, FR-011, FR-012, FR-013).

**Independent Test**: Pick one existing agent config under `config/workflows/` and prove it passes the same validator as another; introduce a missing required field and confirm a single actionable error referencing path, kind, and field.

### Implementation for User Story 1

- [x] T009 [US1] Integrate unified validation into Scrum Master config load path in `src/workflows/scrum-master/load-sm-config.ts` (rules shape, required dispatch targets)
- [x] T010 [P] [US1] Validate pipeline agent configs (`name`, `description`, non-empty `params.steps`, optional `contracts`, required agent-level `model` when the agent uses AI) in `src/lib/pipeline-config.ts` and/or `src/lib/agent-config-validate.ts`
- [x] T011 [US1] Route Spec Gate and Business Analyst entrypoints through shared config validation in `src/workflows/spec-gate/spec-gate-agent.ts` and `src/workflows/business-analyst/business-analyst-core.ts` *(Spec Gate: dispatch input validation; BA uses minimal `model`-only config — full pipeline validation N/A at TS entry)*
- [x] T012 [P] [US1] Align existing configs under `config/workflows/scrum-master/scrum-master.config`, `config/workflows/ai-teammate/ai-teammate.config`, `config/workflows/speckit-developer-agent/speckit-developer-agent.config`, `config/workflows/business-analyst/business-analyst.config`, and `config/workflows/spec-gate/spec-gate.config` with the unified schema and named-contract conventions *(AI Teammate: added top-level `model`)*
- [x] T013 [US1] Document the unified configuration schema and examples for consumers in `config/workflows/README.md`

**Checkpoint**: User Story 1 independently testable via config load/validation only.

---

## Phase 4: User Story 2 — Use GitHub issues as durable memory and history (Priority: P1)

**Goal**: Every run writes a structured body snapshot and append-only timeline comments with config identity, model (when applicable), artifacts, and next actions; failures to write required updates fail the run (FR-003, FR-009, FR-012, FR-020, FR-022).

**Independent Test**: Run one agent against a ticket/issue and confirm start + completion narrative is understandable from the issue alone within a few minutes, without reading workflow logs.

### Implementation for User Story 2

- [ ] T014 [US2] Integrate body snapshot updates (latest structured state) via `src/lib/issue-memory.ts` into AI Teammate orchestration in `src/workflows/ai-teammate/ai-teammate-pipeline.ts` and `src/workflows/ai-teammate/ai-teammate-core.ts` *(not done: structured body snapshot beyond existing Jira block)*
- [x] T015 [P] [US2] Add timeline comments for start/progress/completion events with `{ config_file_path, workflow_ref }` identity in `src/workflows/ai-teammate/ai-teammate-agent.ts` *(implemented in `src/workflows/ai-teammate/steps/create-github-issue.ts` pipeline start comment)*
- [ ] T016 [P] [US2] Wire issue memory (start, completion, errors) for SpecKit Developer Agent in `src/workflows/speckit-developer-agent/speckit-developer-agent.ts` and `src/workflows/speckit-developer-agent/speckit-developer-agent-teardown.ts`
- [ ] T017 [P] [US2] Wire issue memory for Business Analyst flow in `src/workflows/business-analyst/business-analyst-core.ts` and/or `src/workflows/business-analyst/analyze-ticket.ts`
- [x] T018 [US2] Add redaction/safety checks so issue comments and artifact metadata never include secrets (FR-020) in `src/lib/issue-memory.ts` and call sites under `src/workflows/`

**Checkpoint**: User Story 2 independently testable on issue content for one agent run.

---

## Phase 5: User Story 3 — Exchange data via artifacts + contract config (Priority: P1)

**Goal**: Handoffs use artifact bundles + named contracts; parents record artifact identity in the issue; children validate manifest vs contract and fail with explicit drift/mismatch messages (FR-004, FR-006, FR-013, FR-019, FR-021).

**Independent Test**: Execute a two-step parent→child handoff and confirm the child runs from the declared bundle + issue history only, with a clear error if a required contract file is missing or wrong.

### Implementation for User Story 3

- [x] T019 [US3] Upload invocation inputs artifact using `src/lib/invocation-inputs-artifact.ts` from the AI Teammate async dispatch path in `src/workflows/ai-teammate/dispatch-pipeline-async-child-ci.ts` (and any prerequisite job that prepares the payload) *(writes JSON next to repo root for workflow upload; FR-019 best-effort issue comment on write failure)*
- [ ] T020 [P] [US3] Append issue timeline entry linking the handoff bundle and invocation inputs artifact name from `src/workflows/ai-teammate/dispatch-pipeline-async-child-ci.ts` via `src/lib/issue-memory.ts`
- [x] T021 [US3] Harden resume-time validation (manifest paths, non-empty inputs, primary output, contract drift messaging) in `src/lib/invocation-handoff.ts`
- [ ] T022 [P] [US3] Enforce resume correlation between effective config, named contracts, and `stepId` (FR-021) in `src/workflows/ai-teammate/verify-invocation-handoff-ci.ts` and/or `src/lib/invocation-handoff.ts` *(partial: `agentConfigPathAbs` + named contracts on resume manifest check)*
- [x] T023 [US3] Ensure `contractRef` and resolved named contracts flow into handoff manifest preparation in `src/lib/agent-invocation-contract.ts` and parent CI scripts under `src/workflows/ai-teammate/`

**Checkpoint**: User Story 3 independently testable via handoff + resume on a single ticket.

---

## Phase 6: User Story 5 — Fix AI Teammate resume dispatch failure (Priority: P1)

**Goal**: AI Teammate dispatches `speckit-developer-agent.yml` with inputs that match `on.workflow_dispatch.inputs` — no HTTP 422 from unknown keys such as `config_file`; incompatibility is caught before dispatch when possible (FR-008, FR-016, SC-004).

**Independent Test**: Run the resume/handoff path that previously failed and confirm dispatch succeeds; repeat to guard against regression.

### Implementation for User Story 5

- [x] T024 [US5] Align child workflow dispatch payload in `src/workflows/ai-teammate/dispatch-pipeline-async-child-ci.ts` with declared inputs in `.github/workflows/speckit-developer-agent.yml` (remove or remap unsupported keys like `config_file`)
- [x] T025 [P] [US5] Update dispatch input builders in `src/lib/routing_helper.ts` so each target workflow receives only its declared `workflow_dispatch` inputs
- [x] T026 [US5] Invoke `src/lib/workflow-dispatch-validate.ts` immediately before `dispatchGithubWorkflow` in `src/workflows/ai-teammate/dispatch-pipeline-async-child-ci.ts` and `src/lib/dispatch-parent-callback-workflow-ci.ts` *(centralized in `dispatchGithubWorkflow`)*
- [x] T027 [US5] On dispatch validation failure, write FR-016 diagnostics (target workflow, provided keys, rejected keys) to the GitHub issue via `src/lib/issue-memory.ts`

**Checkpoint**: User Story 5 verified by successful dispatch in resume scenario (see `specs/001-agent-config-unification/quickstart.md`).

---

## Phase 7: User Story 4 — Add a new agent by authoring config first (Priority: P2)

**Goal**: New agent configs validate without touching unrelated agents; missing step runners are reported explicitly before execution side effects (FR-007, FR-015, SC-001, SC-005).

**Independent Test**: Add a stub pipeline config referencing an unimplemented `runner` and confirm validation reports the missing runner and location hint; after implementing the runner in the appropriate `src/workflows/**` module, the same config runs.

### Implementation for User Story 4

- [x] T028 [US4] Implement runner→implementation registry (or exhaustive switch) listing supported `runner` strings and their modules under `src/workflows/` in new module `src/lib/pipeline-runner-registry.ts`
- [x] T029 [US4] During config validation, resolve each step’s `runner` against `src/lib/pipeline-runner-registry.ts` and fail with actionable errors (unknown runner, suggested file path) from `src/lib/agent-config-validate.ts`
- [x] T030 [US4] Add a sample stub agent config under new directory `config/workflows/stub-agent-example/stub-agent.config` demonstrating validation failure for a missing runner and success after registry update

**Checkpoint**: User Story 4 independently testable with stub config only.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Concurrency/idempotency, consistent dispatch guards, and quickstart validation.

- [x] T031 [P] Mitigate duplicate/out-of-order issue updates (edge case: concurrent writers) in `src/lib/issue-memory.ts` *(documented limitation + idempotent comment guidance)*
- [x] T032 [P] Apply `src/lib/workflow-dispatch-validate.ts` to other dispatch sites: `src/workflows/scrum-master/scrum-master.ts`, `src/workflows/spec-gate/spec-gate-agent.ts`, and `src/workflows/pr-comment-handler/pr-comment-handler.ts` *(Scrum Master via `dispatchGithubWorkflow`; explicit asserts in spec-gate + pr-comment-handler)*
- [x] T033 Run `npm run check` at repository root and fix TypeScript regressions from this feature
- [ ] T034 Execute validation scenarios in `specs/001-agent-config-unification/quickstart.md` (dispatch success, issue snapshot + comments, canonical invocation artifact name) *(manual / CI)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Stories (Phase 3–7)**: All depend on Foundational completion
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (US1)**: After Foundational — no dependency on other stories; **recommended MVP**
- **User Story 2 (US2)**: After Foundational — uses `src/lib/issue-memory.ts` from Foundational; integrates alongside US1 but should remain independently verifiable on issue content
- **User Story 3 (US3)**: After Foundational — builds on named contracts (US1) and issue memory (US2) for recording artifact identity, but handoff validation is independently testable
- **User Story 5 (US5)**: After Foundational — **strongly depends on T006** (`src/lib/workflow-dispatch-validate.ts`); should follow or overlap US1 once validators exist; issue diagnostics depend on T007 (`src/lib/issue-memory.ts`)
- **User Story 4 (US4)**: After Foundational — best after US1 validation surfaces are stable

### Suggested P1 Story Order (for sequential work)

1. Foundational (Phase 2)
2. US1 → US2 → US3 → US5 (US5 can start once T006 exists; parallel with US2/US3 if staffed)
3. US4 (P2)
4. Polish

### Within Each User Story

- Config validation before runtime side effects
- Issue writers before relying on issue-only operator narrative
- Dispatch payload alignment before live dispatch tests

### Parallel Opportunities

- **Phase 2**: T004, T005, T006, T008 can proceed in parallel once module boundaries are agreed (separate files)
- **US1**: T010, T012 in parallel after T009 is sketched
- **US2**: T015, T016, T017 in parallel after `issue-memory` API is stable
- **US3**: T020, T022 in parallel after T019’s upload path is defined
- **US5**: T025 in parallel with T024 once target input list is fixed
- **Polish**: T031, T032 in parallel

---

## Parallel Example: User Story 1

```bash
# After T009 lands, parallel implementation:
Task: "Validate pipeline agent configs ... in src/lib/pipeline-config.ts and/or src/lib/agent-config-validate.ts"
Task: "Align existing configs ... config/workflows/business-analyst/business-analyst.config"
Task: "Align existing configs ... config/workflows/spec-gate/spec-gate.config"
```

---

## Parallel Example: User Story 2

```bash
# After T014 defines snapshot format, parallel wiring:
Task: "Add timeline comments ... src/workflows/ai-teammate/ai-teammate-agent.ts"
Task: "Wire issue memory ... src/workflows/speckit-developer-agent/speckit-developer-agent.ts"
Task: "Wire issue memory ... src/workflows/business-analyst/business-analyst-core.ts"
```

---

## Parallel Example: User Story 3

```bash
# After invocation artifact upload design:
Task: "Append issue timeline entry ... dispatch-pipeline-async-child-ci.ts"
Task: "Enforce resume correlation ... verify-invocation-handoff-ci.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (critical — shared validators and issue helpers)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Independent test for US1
5. Expand to US2/US3/US5 as needed

### Incremental Delivery

1. Setup + Foundational → shared library ready
2. US1 → unified config validation
3. US2 → mandatory issue memory
4. US3 → contracts + canonical artifacts
5. US5 → dispatch 422 fix + preflight validation
6. US4 → config-first stub agent ergonomics
7. Polish → consistency and regression gates

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1 + consumer docs (`config/workflows/README.md`)
   - Developer B: US2 issue integrations across `src/workflows/`
   - Developer C: US3 handoff + US5 dispatch alignment
3. US4 after US1 stabilizes runner validation

---

## Notes

- [P] tasks assume different files or non-overlapping modules
- [US#] maps each task to spec.md user stories for traceability
- FR/SR references in prose map to `specs/001-agent-config-unification/spec.md`
- Keep dispatch allowlists aligned with `.github/workflows/*.yml` when inputs change

---

## Extension Hooks (after generation)

**Optional Hook**: git  
Command: `/speckit.git.commit`  
Description: Auto-commit after task generation  

Prompt: Commit task changes?  
To execute: `/speckit.git.commit`
