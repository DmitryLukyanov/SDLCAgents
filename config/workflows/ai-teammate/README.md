# AI Teammate — pipeline config

This folder holds the **agent JSON** consumed by `ai-teammate-agent.ts` when the consumer repo runs **`_reusable-ai-teammate.yml`**.

## How BA runs in CI

Business Analyst Codex is **not** a `runPipelineStep` runner; it is **`ba_codex_async`** in this JSON, wired by `_reusable-ai-teammate.yml`:

1. **Prepare** — `check-ba-skip-label-ci` sets **`skip_reason`** (empty = BA OK). `AI_TEAMMATE_MODE=pipeline_ci` runs `params.steps` until **`ba_codex_async`**: if enabled and not gated, it writes **all invocation input artifacts** under **`async-invocation-handoff/<key>/`** (paths come from the async step **`contract`**; defaults: `invocation-prompt.md`, `invocation-jira-context.md`, plus internal `ba-codex-state.json` / prep JSON).
2. **Verify + upload + dispatch** — `_reusable-ai-teammate.yml` runs **`verify-invocation-handoff-ci.ts`** so every **`contract.inputParams`** file exists, then uploads that handoff directory as **`ai-teammate-ba-<key>-prepare`**, then dispatches the child workflow with **`invocation_*`** string inputs (relative filenames). The child downloads the same bundle and verifies inputs again before Codex.
3. **Resume** — early YAML steps download parent + child artifacts when `caller_config.params.async_child_run_id` is set; the same `pipeline_ci` step runs **`codex_ba_finish`** logic (apply BA, then **`start_developer_agent`**).

For local debugging without Actions, `codex_ba_prepare` / `codex_ba_finish` modes on `ai-teammate-agent.ts` still exist.

The reusable workflow sets `AI_TEAMMATE_MODE`; you do not set it in this JSON file.

## Required pipeline shape

- **`params.runner`** must be **`"pipeline"`**.
- **`params.skipIfLabel`** / **`params.addLabel`** (optional strings) — shared Jira label gate for the pipeline (same pattern as scrum-master rules): if the ticket already has **`skipIfLabel`**, `_reusable-ai-teammate.yml` skips the BA segment (`ba_codex_async` and **`start_developer_agent`** on that run; see **Jira — check skip-if-label**). After a **complete** BA outcome, **`addLabel`** is applied on the Jira ticket.
- **`params.steps`** must be a non-empty array in **execution order**:
  1. **`ensure_jira_fields_expected`** (optional but recommended) — block empty descriptions.
  2. **`create_github_issue`** — creates the GitHub issue and sets the body to the BA placeholder plus a **Jira context snapshot** (marker `<!-- sdlc-agents:jira-context -->`). Later steps read that snapshot from the issue body (or legacy comments) via the API.
  3. Optional step with **`async_call`** (e.g. **`ba_codex_async`**) — when **`enabled`: true**, Codex runs only in the separate consumer workflow named by **`async_call.workflowFile`** (see consumer-templates `business-analyst.yml`). AI Teammate does not run Codex inline.
  4. **`start_developer_agent`** — issue body from BA template + `workflow_dispatch` of the developer agent. Set **`"enabled": false`** on this step to skip it entirely (no issue-body rewrite from `github-issue.md`, no developer-agent dispatch). Default is enabled when the field is omitted.

## Consumer setup

1. Copy **`ai-teammate.config`** (and this README if you want) into the same path in your repo, e.g. `config/workflows/ai-teammate/`.
2. Point **Scrum Master** rules at that path (`configFile` in `scrum-master.config`).
3. Ensure secrets **`COPILOT_PAT`**, **`OPENAI_API_KEY`**, and Jira secrets match what `_reusable-ai-teammate.yml` expects.
4. Install the consumer workflow from **`.github/consumer-templates/ai-teammate.yml`** (or equivalent) calling the reusable workflow with `secrets: inherit`.
5. If you use async Codex, keep **`.github/consumer-templates/business-analyst.yml`** in sync: it must declare **`invocation_prompt_file`**, **`invocation_jira_context_file`**, and **`invocation_output_file`** (parent dispatch always sends them; defaults match `DEFAULT_AGENT_INVOCATION_CONTRACT`).

## Async invocation `contract` (artifact-only, agent-agnostic)

On the step that declares **`async_call`**, optional **`contract`** describes **artifact files** under **`async-invocation-handoff/<issueKey>/`** (same tree the prepare job zips into **`ai-teammate-ba-<key>-prepare`**).

- **`inputParams`** — map of **logical name →** `{ "kind": "artifact", "scope": "handoff_workspace", "relativePath": "..." }`. Omitted keys inherit defaults (`prompt`, `jiraContext`). Extra keys are allowed in the type system; **Codex BA prepare** currently only materializes **`prompt`** and **`jiraContext`** (see `assertBaCodexPrepareContract` in `agent-invocation-contract.ts`).
- **`outputParams`** — same shape for outputs. If you **set** `outputParams` in JSON, it **replaces** the default map entirely (you must list every output artifact, e.g. your primary file). If you **omit** `outputParams`, defaults apply (`resultState` → `invocation-output.txt`).
- **`primaryOutputKey`** (optional) — which `outputParams` key becomes `codexRelativeOutputPath` in `ba-codex-state.json` and the Codex `output-file`. If omitted, **`resultState`** is used when present; otherwise the sole output key must be unambiguous.

### How it works

1. **Parent (`_reusable-ai-teammate`)** — TypeScript **`codex_ba_prepare_prompt`** writes the **BA** inputs (defaults):
   - **`inputParams.prompt`** — full LLM instructions + embedded ticket block.
   - **`inputParams.jiraContext`** — Markdown ticket snapshot for tools that read files instead of Jira APIs.
   - Internal **`ba-codex-state.json`** records `codexRelativeOutputPath` for the resolved primary output.
2. **`verify-invocation-handoff-ci.ts`** (parent) — asserts **every** **`contract.inputParams`** file exists and is non-empty before upload.
3. **Upload** — `actions/upload-artifact` sends the **entire** `async-invocation-handoff/<concurrency_key>/` directory, so **every** declared input artifact is included (plus internal JSON).
4. **Consumer (`business-analyst.yml`)** — downloads the bundle into **`async-invocation-handoff/<key>/`**, verifies the **bound** inputs (`invocation_prompt_file`, `invocation_jira_context_file`), then **`_reusable-codex-run`** using **`invocation_output_file`** for the primary output path.

Types and parsing: `src/lib/agent-invocation-contract.ts`. Omit **`contract`** to use defaults (`invocation-prompt.md`, `invocation-jira-context.md`, `invocation-output.txt`).

## Local dry run

From the SDLCAgents repo (with a matching `config/` layout and mocks), **`npm run ai-teammate:debug`** runs **prepare only** with mocked Jira/GitHub.
