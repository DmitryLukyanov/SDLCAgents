# Requirements Quality Checklist: Config-first Agent Platform

**Purpose**: Validate that requirements are written to minimize bespoke code and maximize config-driven reuse  
**Created**: 2026-05-07  
**Feature**: `specs/001-agent-config-unification/spec.md`  
**Last validated**: 2026-05-07 — spec includes FR-010–FR-023, SC-005, FR-021–FR-023; remaining open item: concurrent issue updates (edge list only).

## Requirement Completeness

- [x] CHK001 Are “unified configuration approach” requirements explicit about which config *kinds* exist and how they relate (e.g., routers vs pipelines)? [Completeness, Spec §FR-010]
- [x] CHK002 Do requirements enumerate the minimum required fields for each agent config kind (including defaults vs required)? [Completeness, Spec §FR-010, Spec §FR-011]
- [x] CHK003 Do requirements define what “config identity” means (path + ref/version) and where it must be recorded for operators? [Completeness, Spec §FR-012, Spec §FR-003]
- [x] CHK004 Are requirements explicit about how a new agent is introduced “config-first” (what must exist before any code is written)? [Completeness, Spec §FR-007]
- [x] CHK005 Are requirements explicit about the minimum “unique functionality” that must be implemented in code for a new agent vs what MUST be config? [Completeness, Spec §FR-015]
- [x] CHK006 Do requirements explicitly state which behaviors MUST remain shared/common across agents (routing, dispatching, config parsing, validation, resume rules)? [Completeness, Spec §FR-014]
- [x] CHK007 Are requirements explicit about how named reusable contracts are declared and referenced by steps (including override rules)? [Completeness, Spec §FR-004, Spec §FR-017, Spec §FR-018]
- [x] CHK008 Are requirements explicit about canonical artifact naming inputs (`issueKey`, `stepId`) and where `stepId` comes from? [Completeness, Spec §FR-006, Spec §FR-013, Spec §FR-023]

## Requirement Clarity

- [x] CHK009 Is “write less code and rely on config” translated into measurable or testable requirement language (not just intent)? [Clarity, Spec §SC-005, Spec §FR-014, Spec §FR-015]
- [x] CHK010 Is “unique functionality for this agent” defined in a way that reviewers can consistently apply (examples or boundary conditions)? [Clarity, Spec §FR-015]
- [x] CHK011 Is “unified config parsing” defined without ambiguity (single parser + shared validation vs per-agent parsers)? [Clarity, Spec §FR-014]
- [x] CHK012 Is “routing/dispatching logic ideally would be shared” expressed as MUST/SHOULD with explicit exceptions (if any)? [Clarity, Spec §FR-002, Spec §FR-014]
- [x] CHK013 Is the “hard fail if issue updates fail” requirement specific about what constitutes a “required” update vs optional commentary? [Clarity, Spec §FR-009]
- [x] CHK014 Is “dispatch payloads must match the target workflow input schema” specific about what level of checking is required (known keys only, reject unknown keys, error format)? [Clarity, Spec §FR-008, Spec §FR-016]

## Requirement Consistency

- [x] CHK015 Are the “config-first new agent” requirements consistent with “fail early” behavior (no partial side effects on missing runners)? [Consistency, Spec §FR-007]
- [x] CHK016 Are the contract requirements consistent with “artifact-only invocation” (no duplicative workflow inputs for contract file paths)? [Consistency, Spec §FR-004]
- [x] CHK017 Are the GitHub issue memory requirements (body snapshot + comments timeline) consistent with the failure-mode requirement (hard fail on inability to write)? [Consistency, Spec §FR-003, Spec §FR-009]
- [x] CHK018 Are model configuration requirements consistent across all AI-using agents (single agent-level model; no per-step overrides) without contradicting any existing assumptions? [Consistency, Spec §FR-005]

## Acceptance Criteria Quality

- [x] CHK019 Do success criteria include at least one measurable indicator that “config-driven reuse” improved (e.g., reduction of duplicated routing/dispatch parsing logic) in requirement terms? [Completeness, Spec §SC-005]
- [x] CHK020 Are acceptance scenarios written so a reviewer can objectively determine whether “shared routing/dispatch/config parsing” is achieved without reading implementation details? [Measurability, Spec §US1, Spec §FR-014]
- [x] CHK021 Is the “422 regression” scenario specified in a way that unambiguously defines “dispatch compatibility” (what inputs are allowed/forbidden)? [Clarity, Spec §US5, Spec §FR-008]

## Scenario Coverage

- [x] CHK022 Do requirements cover the scenario “add a new agent config that references an unimplemented runner” with clear expected system messaging and stopping behavior? [Coverage, Spec §US4, Spec §FR-007]
- [x] CHK023 Do requirements cover multiple agents per ticket and step-id uniqueness implications for canonical artifact names? [Coverage, Spec §FR-006, Spec §FR-013, Spec §FR-023]
- [x] CHK024 Do requirements cover resume/retry flows and whether config/contract identity must remain stable across retries? [Coverage, Spec §FR-004, Spec §FR-021]
- [x] CHK025 Do requirements cover the “shared parsing/validation” expectation for both router configs (rules) and pipeline configs (steps)? [Coverage, Spec §FR-010, Spec §FR-014]

## Edge Case Coverage

- [x] CHK026 Do requirements explicitly define what happens when a config references a named contract that does not exist? [Coverage, Spec §FR-017]
- [x] CHK027 Do requirements explicitly define what happens when a step references a contract but overrides create a conflict with the named contract? [Coverage, Spec §FR-018]
- [x] CHK028 Do requirements specify how to detect and report “contract drift” between a stored manifest and a changed config? [Coverage, Spec §FR-004, Spec §US3]
- [x] CHK029 Do requirements specify what happens when canonical artifact upload fails (inputs artifact) given GitHub issue updates are mandatory? [Coverage, Spec §FR-019, Spec §FR-009]
- [x] CHK030 Do requirements specify the expected operator-facing message format when dispatch input validation fails (unknown keys)? [Coverage, Spec §FR-016]

## Non-Functional Requirements (requirements presence/quality)

- [x] CHK031 Are observability requirements specified for config parsing/dispatch decisions (so operators can explain “why this config was selected”)? [Completeness, Spec §FR-022, Spec §FR-003, Spec §FR-012]
- [x] CHK032 Are reliability requirements specified for shared components (config parsing, dispatching, issue updates) given they are cross-agent dependencies? [Completeness, Spec §FR-011, Spec §FR-009, Spec §FR-021, Spec §SC-003]
- [x] CHK033 Are security/privacy requirements for issue contents and artifacts explicitly bounded (what MUST NOT be written)? [Completeness, Spec §FR-020]

## Dependencies & Assumptions

- [x] CHK034 Are assumptions about GitHub Issues availability/permissions written as enforceable requirements or explicitly accepted risks? [Assumption, Spec §Assumptions, Spec §FR-009]
- [x] CHK035 Are assumptions about artifact availability and retention documented and consistent with the artifact-only contract approach? [Assumption, Spec §Assumptions — artifacts assumed non-expiring]

## Ambiguities & Conflicts

- [x] CHK036 Is “unified approach” at risk of being interpreted as “one config schema for all agents,” and if so, do requirements explicitly avoid/allow multiple kinds with shared conventions? [Clarity, Spec §FR-010]
- [x] CHK037 Do requirements clearly distinguish between “shared orchestration code” vs “unique agent operations” so reviewers can consistently reject unnecessary new orchestration code? [Clarity, Spec §FR-014, Spec §FR-015]

## Notes

- This checklist intentionally tests whether the *requirements* enforce “config-first + shared plumbing,” not whether the implementation achieves it.
- **Still light in spec (edge list only, no FR yet)**: concurrent updates to the same GitHub issue (ordering / idempotency / duplication) — track in `spec.md` §Edge Cases or a follow-up spec amendment if you want full checklist coverage there too.
