# AI Teammate — pipeline config

This folder holds the **agent JSON** consumed by `ai-teammate-agent.ts` when the consumer repo runs **`_reusable-ai-teammate.yml`**.

## How BA runs in CI

Business Analyst Codex is **not** a `runPipelineStep` runner; it is **`ba_codex_async`** in this JSON, wired by `_reusable-ai-teammate.yml`:

1. **Prepare** — `check-ba-skip-label-ci` sets **`skip_reason`** (empty = BA OK). `AI_TEAMMATE_MODE=pipeline_ci` runs `params.steps` until **`ba_codex_async`**: if enabled and not gated, it writes `ba-codex-prompt.md` and `ba-codex-state.json`.
2. **Upload + dispatch** — the reusable workflow uploads the prepare bundle, then dispatches the consumer workflow from **`async_call.workflowFile`** (e.g. `business-analyst.yml`), which runs Codex and callbacks the parent.
3. **Resume** — early YAML steps download parent + child artifacts when `caller_config.params.async_child_run_id` is set; the same `pipeline_ci` step runs **`codex_ba_finish`** logic (apply BA, then **`start_developer_agent`**).

For local debugging without Actions, `codex_ba_prepare` / `codex_ba_finish` modes on `ai-teammate-agent.ts` still exist.

The reusable workflow sets `AI_TEAMMATE_MODE`; you do not set it in this JSON file.

## Required pipeline shape

- **`params.runner`** must be **`"pipeline"`**.
- **`params.skipIfLabel`** / **`params.addLabel`** (optional strings) — shared Jira label gate for the pipeline (same pattern as scrum-master rules): if the ticket already has **`skipIfLabel`**, `_reusable-ai-teammate.yml` skips the BA segment (`ba_codex_async` and **`start_developer_agent`** on that run; see **Jira — check skip-if-label**). After a **complete** BA outcome, **`addLabel`** is applied on the Jira ticket.
- **`params.steps`** must be a non-empty array in **execution order**:
  1. **`ensure_jira_fields_expected`** (optional but recommended) — block empty descriptions.
  2. **`create_github_issue`** — creates the placeholder issue and posts a **Jira context snapshot** as a GitHub comment (marker `<!-- sdlc-agents:jira-context -->`). Later steps read that comment via the API.
  3. Optional step with **`async_call`** (e.g. **`ba_codex_async`**) — when **`enabled`: true**, Codex runs only in the separate consumer workflow named by **`async_call.workflowFile`** (see consumer-templates `business-analyst.yml`). AI Teammate does not run Codex inline.
  4. **`start_developer_agent`** — issue body from BA template + `workflow_dispatch` of the developer agent. Set **`"enabled": false`** on this step to skip it entirely (no issue-body rewrite from `github-issue.md`, no developer-agent dispatch). Default is enabled when the field is omitted.

## Consumer setup

1. Copy **`ai-teammate.config`** (and this README if you want) into the same path in your repo, e.g. `config/workflows/ai-teammate/`.
2. Point **Scrum Master** rules at that path (`configFile` in `scrum-master.config`).
3. Ensure secrets **`COPILOT_PAT`**, **`OPENAI_API_KEY`**, and Jira secrets match what `_reusable-ai-teammate.yml` expects.
4. Install the consumer workflow from **`.github/consumer-templates/ai-teammate.yml`** (or equivalent) calling the reusable workflow with `secrets: inherit`.

## Local dry run

From the SDLCAgents repo (with a matching `config/` layout and mocks), **`npm run ai-teammate:debug`** runs **prepare only** with mocked Jira/GitHub.
