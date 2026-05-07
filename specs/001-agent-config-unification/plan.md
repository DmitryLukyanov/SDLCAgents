# Implementation Plan: Agent Config Unification

**Branch**: `[speckit-review]` | **Date**: 2026-05-07 | **Spec**: `specs/001-agent-config-unification/spec.md`
**Input**: Feature specification from `specs/001-agent-config-unification/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Unify how all agents are configured (rules, steps, contracts, models) and how they
communicate (artifacts + declarative contracts) while using GitHub issues as the durable
memory surface (body snapshot + timeline comments). Fix the AI Teammate → SpecKit
Developer Agent dispatch regression where a terminal workflow is dispatched with
unexpected `workflow_dispatch` inputs (currently `config_file`), and improve the existing
SpecKit “step-by-step + extra validation” flow (Codex via `openai/codex-action@v1`).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Node.js >= 20)  
**Primary Dependencies**: GitHub Actions, `@octokit/rest`, `openai/codex-action@v1`  
**Storage**: GitHub Issues (durable memory) + GitHub Actions Artifacts (handoff bundles)  
**Testing**: Existing repo tests under `tests/` (unit/integration); TypeScript typecheck via `npm run check`  
**Target Platform**: GitHub Actions runners (consumer repos call reusable workflows from SDLCAgents)  
**Project Type**: TypeScript library + reusable GitHub Actions workflows  
**Performance Goals**: Dispatch and validation overhead low enough to keep typical ticket runs within CI expectations (seconds/minutes, not hours)  
**Constraints**: Must be agent-agnostic and config-first; issue updates are mandatory (fail run if cannot write)  
**Scale/Scope**: Multiple agents and steps per ticket; frequent resumes/retries; needs predictable artifact naming and validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Per `.specify/memory/constitution.md` (SDLCAgents):

- **Agent-agnostic core**: Design keeps shared orchestration free of single-vendor lock-in; runner-specific logic is adapter/config scoped.
- **Configuration-driven orchestration**: Flow and knobs live in config where possible; TypeScript covers operations and contracts, not one-off forks of the same pipeline.
- **Operations as extension surface**: New roles/agents add operations and wire them in config rather than duplicating orchestration.
- **TypeScript discipline**: Plan technical context matches TS/Node; typecheck and agreed test scope remain feasible.
- **Stable consumer contract**: Onboarding paths, copied artifacts, and documented secrets stay compatible or the plan documents migration.

If any gate cannot be met, document justification in **Complexity Tracking** below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── lib/                       # shared config/contract/dispatch helpers
└── workflows/
    ├── scrum-master/
    ├── ai-teammate/
    ├── business-analyst/
    ├── speckit-developer-agent/
    └── spec-gate/

config/
└── workflows/
    ├── scrum-master/
    ├── ai-teammate/
    ├── business-analyst/
    ├── speckit-developer-agent/
    └── spec-gate/

.github/workflows/             # reusable workflows + entry workflows consumers copy
tests/
```

**Structure Decision**: Single TypeScript repo with workflow implementations under `src/workflows/**`,
shared helpers under `src/lib/**`, and consumer-facing configs under `config/workflows/**`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
