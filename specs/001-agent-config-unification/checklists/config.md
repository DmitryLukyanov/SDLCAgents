# Requirements Quality Checklist: Config-first Agent Platform

**Purpose**: Validate that requirements are written to minimize bespoke code and maximize config-driven reuse  
**Created**: 2026-05-07  
**Feature**: `specs/001-agent-config-unification/spec.md`

## Requirement Completeness

- [ ] CHK001 Are “unified configuration approach” requirements explicit about which config *kinds* exist and how they relate (e.g., routers vs pipelines)? [Completeness, Spec §FR-001]
- [ ] CHK002 Do requirements enumerate the minimum required fields for each agent config kind (including defaults vs required)? [Gap, Spec §FR-001]
- [ ] CHK003 Do requirements define what “config identity” means (path + ref/version) and where it must be recorded for operators? [Gap, Spec §FR-003]
- [ ] CHK004 Are requirements explicit about how a new agent is introduced “config-first” (what must exist before any code is written)? [Completeness, Spec §FR-007]
- [ ] CHK005 Are requirements explicit about the minimum “unique functionality” that must be implemented in code for a new agent vs what MUST be config? [Gap, Spec §FR-007]
- [ ] CHK006 Do requirements explicitly state which behaviors MUST remain shared/common across agents (routing, dispatching, config parsing, validation, resume rules)? [Gap, Spec §FR-001]
- [ ] CHK007 Are requirements explicit about how named reusable contracts are declared and referenced by steps (including override rules)? [Completeness, Spec §FR-004]
- [ ] CHK008 Are requirements explicit about canonical artifact naming inputs (`issueKey`, `stepId`) and where `stepId` comes from? [Gap, Spec §FR-006]

## Requirement Clarity

- [ ] CHK009 Is “write less code and rely on config” translated into measurable or testable requirement language (not just intent)? [Ambiguity, Spec §FR-001]
- [ ] CHK010 Is “unique functionality for this agent” defined in a way that reviewers can consistently apply (examples or boundary conditions)? [Clarity, Spec §FR-007]
- [ ] CHK011 Is “unified config parsing” defined without ambiguity (single parser + shared validation vs per-agent parsers)? [Ambiguity, Spec §FR-001]
- [ ] CHK012 Is “routing/dispatching logic ideally would be shared” expressed as MUST/SHOULD with explicit exceptions (if any)? [Clarity, Spec §FR-002]
- [ ] CHK013 Is the “hard fail if issue updates fail” requirement specific about what constitutes a “required” update vs optional commentary? [Clarity, Spec §FR-009]
- [ ] CHK014 Is “dispatch payloads must match the target workflow input schema” specific about what level of checking is required (known keys only, reject unknown keys, error format)? [Clarity, Spec §FR-008]

## Requirement Consistency

- [ ] CHK015 Are the “config-first new agent” requirements consistent with “fail early” behavior (no partial side effects on missing runners)? [Consistency, Spec §FR-007]
- [ ] CHK016 Are the contract requirements consistent with “artifact-only invocation” (no duplicative workflow inputs for contract file paths)? [Consistency, Spec §FR-004]
- [ ] CHK017 Are the GitHub issue memory requirements (body snapshot + comments timeline) consistent with the failure-mode requirement (hard fail on inability to write)? [Consistency, Spec §FR-003, Spec §FR-009]
- [ ] CHK018 Are model configuration requirements consistent across all AI-using agents (single agent-level model; no per-step overrides) without contradicting any existing assumptions? [Consistency, Spec §FR-005]

## Acceptance Criteria Quality

- [ ] CHK019 Do success criteria include at least one measurable indicator that “config-driven reuse” improved (e.g., reduction of duplicated routing/dispatch parsing logic) in requirement terms? [Gap, Spec §SC-001–SC-004]
- [ ] CHK020 Are acceptance scenarios written so a reviewer can objectively determine whether “shared routing/dispatch/config parsing” is achieved without reading implementation details? [Measurability, Spec §US1]
- [ ] CHK021 Is the “422 regression” scenario specified in a way that unambiguously defines “dispatch compatibility” (what inputs are allowed/forbidden)? [Clarity, Spec §US5]

## Scenario Coverage

- [ ] CHK022 Do requirements cover the scenario “add a new agent config that references an unimplemented runner” with clear expected system messaging and stopping behavior? [Coverage, Spec §US4, Spec §FR-007]
- [ ] CHK023 Do requirements cover multiple agents per ticket and step-id uniqueness implications for canonical artifact names? [Coverage, Spec §FR-006]
- [ ] CHK024 Do requirements cover resume/retry flows and whether config/contract identity must remain stable across retries? [Gap, Spec §FR-004]
- [ ] CHK025 Do requirements cover the “shared parsing/validation” expectation for both router configs (rules) and pipeline configs (steps)? [Coverage, Spec §FR-001]

## Edge Case Coverage

- [ ] CHK026 Do requirements explicitly define what happens when a config references a named contract that does not exist? [Gap, Spec §FR-004]
- [ ] CHK027 Do requirements explicitly define what happens when a step references a contract but overrides create a conflict with the named contract? [Gap, Spec §FR-004]
- [ ] CHK028 Do requirements specify how to detect and report “contract drift” between a stored manifest and a changed config? [Coverage, Spec §FR-004]
- [ ] CHK029 Do requirements specify what happens when canonical artifact upload fails (inputs artifact) given GitHub issue updates are mandatory? [Gap, Spec §FR-006, Spec §FR-009]
- [ ] CHK030 Do requirements specify the expected operator-facing message format when dispatch input validation fails (unknown keys)? [Gap, Spec §FR-008]

## Non-Functional Requirements (requirements presence/quality)

- [ ] CHK031 Are observability requirements specified for config parsing/dispatch decisions (so operators can explain “why this config was selected”)? [Gap, Spec §FR-003]
- [ ] CHK032 Are reliability requirements specified for shared components (config parsing, dispatching, issue updates) given they are cross-agent dependencies? [Gap]
- [ ] CHK033 Are security/privacy requirements for issue contents and artifacts explicitly bounded (what MUST NOT be written)? [Gap, Spec §FR-003]

## Dependencies & Assumptions

- [ ] CHK034 Are assumptions about GitHub Issues availability/permissions written as enforceable requirements or explicitly accepted risks? [Assumption, Spec §Assumptions]
- [ ] CHK035 Are assumptions about artifact availability and retention explicitly linked to the contract approach (risk if artifacts expire)? [Assumption, Spec §Assumptions]

## Ambiguities & Conflicts

- [ ] CHK036 Is “unified approach” at risk of being interpreted as “one config schema for all agents,” and if so, do requirements explicitly avoid/allow multiple kinds with shared conventions? [Ambiguity, Spec §FR-001]
- [ ] CHK037 Do requirements clearly distinguish between “shared orchestration code” vs “unique agent operations” so reviewers can consistently reject unnecessary new orchestration code? [Ambiguity, Spec §FR-007]

## Notes

- This checklist intentionally tests whether the *requirements* enforce “config-first + shared plumbing,” not whether the implementation achieves it.
