## SDLC Pipeline Onboarding

This PR was created automatically by the onboarding workflow.

### What's included
- `.specify/` — spec-kit scripts, templates, and integrations
- `.github/workflows/` — ai-teammate, scrum-master, copilot-setup-steps, pr-merged
- `.github/agents/` — spec-kit agent files (Copilot / IDE)
- `.github/prompts/` — spec-kit prompt files
- `.github/copilot-instructions.md`
- `.agents/skills/` — native Codex skill files (`speckit-specify`, `speckit-plan`, …)
- `config/spec-kit/` — defaults and constitution
- `config/workflows/` — ai-teammate and scrum-master configs

### Next steps
1. Review the config files under `config/workflows/` for your project settings
2. Ensure the `COPILOT_PAT` and `OPENAI_API_KEY` secrets are set in this repo
3. Merge this PR to activate the pipeline

> **How spec-kit steps are executed in CI**
> The pipeline uses `.agents/skills/speckit-{step}/SKILL.md` (native Codex skills)
> as the primary execution path — identical to running `\speckit-specify` locally.
> Copilot agent files in `.github/agents/` serve as a fallback.
