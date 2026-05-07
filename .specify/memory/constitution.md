<!--
Sync Impact Report
- Version: (unreleased template) → 1.0.0 — Initial adoption: first governed constitution for this repository (semantic MAJOR as baseline v1).
- Modified principles: N/A (placeholders replaced with five core principles).
- Added sections: TypeScript & Platform Standards; Consumer Onboarding & Integration.
- Removed sections: None.
- Templates: .specify/templates/plan-template.md ✅ updated (Constitution Check gates). .specify/templates/spec-template.md ✅ reviewed, no change. .specify/templates/tasks-template.md ✅ reviewed, no change. .specify/templates/commands/*.md — N/A (path not used in this repo).
- Follow-up TODOs: None.
-->

# SDLCAgents Constitution

## Core Principles

### I. Agent-Agnostic Core

Shared orchestration, routing, and I/O MUST remain independent of any single LLM vendor, IDE agent, or runner implementation. Integrations (for example Codex actions, Copilot sessions, or future runners) MUST live behind clear boundaries: configuration, adapters, or thin glue modules. Rationale: consumer repositories onboard from this source; locking core logic to one product breaks reuse and complicates multi-agent evolution described in project goals.

### II. Configuration-Driven Orchestration

Pipeline flow, step ordering, prompts, and workflow knobs MUST be expressed in configuration or declarative artifacts wherever behavior is environmental or product-specific. TypeScript code MUST implement operations, contracts, and integration mechanics—not copy-paste variants of the same flow per agent. Rationale: new agents SHOULD require new operations plus prompt and pipeline config, not parallel codebases.

### III. Operations as the Primary Extension Surface

Introducing a new agent or SDLC role MUST favor implementing discrete operations (inputs, outputs, side effects) and registering them in configuration over duplicating orchestration. Shared steps (gate, proceed, state) MUST remain reusable. Rationale: keeps the “implement operations → configure prompts → wire pipeline in config” model enforceable in review.

### IV. TypeScript Platform Discipline

Implementation MUST be TypeScript on Node.js (see repository `engines`). Public surfaces MUST be typed; `npm run check` (`tsc --noEmit`) MUST pass on merged work. Non-trivial library behavior MUST have automated tests (`npm run test:lib` or successor scripts). Rationale: this repo is the canonical TypeScript implementation of the agent platform; type and test gates protect downstream consumers.

### V. Stable Consumer Contract

Artifacts and paths consumed by onboarding workflows (workflows, skills, config trees, secrets, documented checklists) MUST be treated as a compatibility surface. Breaking changes MUST be versioned, documented, and accompanied by migration or dual-support notes where feasible. Rationale: consumer applications adopt agents through onboarding; silent breakage undermines trust and rollout.

## TypeScript & Platform Standards

- Primary language: TypeScript (ES modules per `package.json`).
- Runtime: Node.js version per repository `engines` (currently >= 20).
- Dependencies: minimize; justify new runtime dependencies in review.
- Scripts: use existing npm scripts for typecheck and library tests; extend them rather than ad-hoc commands in documentation.

## Consumer Onboarding & Integration

- Onboarding flows MUST remain reproducible from documented entrypoints (for example GitHub Actions and checklist in `README.md`).
- Features that change what consumer repos copy or configure MUST update onboarding documentation and any templates involved in that path.
- Human-in-the-loop and gate workflows MUST remain coherent with state artifacts (for example `speckit-state.json`) and PR interaction models already documented for consumers.

## Governance

- This constitution supersedes ad-hoc practices for this repository when they conflict; amendments supersede prior text.
- Amendments: propose in a PR that edits this file; include Sync Impact Report updates in the HTML comment; obtain maintainer approval before merge.
- Versioning: follow semantic versioning for the constitution itself—MAJOR for incompatible governance or principle removals/redefinitions; MINOR for new principles or materially expanded guidance; PATCH for clarifications and non-semantic wording.
- Compliance: reviewers MUST verify PRs against Core Principles and relevant sections; unjustified violations require entries in plan Complexity Tracking (see plan template Constitution Check).
- Dates: use ISO-8601 (`YYYY-MM-DD`) in this document.

**Version**: 1.0.0 | **Ratified**: 2026-05-07 | **Last Amended**: 2026-05-07
