# AI Teammate — pipeline config

This folder holds the **agent JSON** consumed by `ai-teammate-agent.ts` when the consumer repo runs **`_reusable-ai-teammate.yml`**.

## How BA runs today

Business Analyst work is **not** done inside the TypeScript pipeline as a normal step. It runs in three GitHub Actions jobs:

1. **Prepare** — CI runs `check-ba-skip-label-ci` (sets **`skip_reason`**: empty = BA OK, non-empty = skip), then `codex_ba_create_github_issue`, then `codex_ba_prepare_prompt` **only if** `skip_reason` is empty (writes `ba-codex-prompt.md` and `ba-codex-state.json`). For a single process, `codex_ba_prepare` runs both TS phases (e.g. local debug) and does **not** apply the YAML-only label check.
2. **Codex** — `openai/codex-action@v1` reads that prompt and writes `ba-codex-output.txt`.
3. **Finish** — `AI_TEAMMATE_MODE=codex_ba_finish`: parses Codex output, applies BA outcome, runs **`start_developer_agent`**.

The reusable workflow sets `AI_TEAMMATE_MODE`; you do not set it in this JSON file.

## Required pipeline shape

- **`params.runner`** must be **`"pipeline"`**.
- **`params.steps`** must be a non-empty array in **execution order**:
  1. **`ensure_jira_fields_expected`** (optional but recommended) — block empty descriptions.
  2. **`print_jira_context_to_stdout`** — spec-kit workspace / `issueContext.md`.
  3. **`create_github_issue`** — placeholder GitHub issue; prepare stops **after** this step.
  4. **`run_ba_inline`** — **configuration only** (not executed as a runner). Codex BA uses this object for:
     - **`skipIfLabel`** — if the Jira ticket already has this label, `_reusable-ai-teammate.yml` skips `codex_ba_prepare_prompt` and Codex BA (see step **Jira — check BA skip label**).
     - **`addLabel`** — label applied on the Jira ticket after a **complete** BA outcome.
  5. **`start_developer_agent`** — issue body + Copilot assignment + `workflow_dispatch` of the developer agent.

The step name **`run_ba_inline` is fixed** — the code looks it up by that string. Do not rename it unless you change the TypeScript loader.

## Consumer setup

1. Copy **`ai-teammate.config`** (and this README if you want) into the same path in your repo, e.g. `config/workflows/ai-teammate/`.
2. Point **Scrum Master** rules at that path (`configFile` in `scrum-master.config`).
3. Ensure secrets **`COPILOT_PAT`**, **`OPENAI_API_KEY`**, and Jira secrets match what `_reusable-ai-teammate.yml` expects.
4. Install the consumer workflow from **`.github/consumer-templates/ai-teammate.yml`** (or equivalent) calling the reusable workflow with `secrets: inherit`.

## Local dry run

From the SDLCAgents repo (with a matching `config/` layout and mocks), **`npm run ai-teammate:debug`** runs **prepare only** with mocked Jira/GitHub.
