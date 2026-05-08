# AI Teammate — pipeline config

This folder holds the **agent JSON** consumed by `ai-teammate-agent.ts` when the consumer repo runs **`_reusable-ai-teammate.yml`**.

## How BA runs in CI

Business Analyst Codex is **not** a `runPipelineStep` runner; it runs in a **child** workflow (`async_call`, e.g. `business-analyst.yml`), wired by `_reusable-ai-teammate.yml`:

1. **Prepare** — `AI_TEAMMATE_MODE=pipeline_ci` runs `params.steps` until the first step with **`async_call`**: before the loop, `runPipelineCi` may set **`ctx.skipBaReason`** from **`evaluateSkipIfLabelFromConfigFile`** (Jira vs `params.skipIfLabel`). If not gated, prepare writes **invocation artifacts** under **`async-invocation-handoff/<key>/`** (from the async step **`contract`**; defaults: `invocation-prompt.md`, `invocation-jira-context.md`, plus `ba-codex-state.json` / prep JSON).
2. **Verify + upload + dispatch** — `_reusable-ai-teammate.yml` runs **`verify-invocation-handoff-ci.ts`** so every **`contract.inputParams`** file exists, then uploads that handoff directory as **`caller-handoff_input`**, then dispatches the child workflow with **`invocation_*`** string inputs (relative filenames). The child downloads the same bundle and verifies inputs again before Codex.
3. **Resume** — early YAML steps download parent + child artifacts when `caller_config.params.async_child_run_id` is set; the same `pipeline_ci` step resumes at `async_trigger_step` and continues with sync steps (e.g. `apply_ba_outcome`).

For local debugging without Actions, use **`npm run ai-teammate:debug`** (`pipeline_ci` with mocks).

The reusable workflow sets `AI_TEAMMATE_MODE`; you do not set it in this JSON file.

## Required pipeline shape

- **`params.runner`** must be **`"pipeline"`**.
- **`params.skipIfLabel`** / **`params.addLabel`** (optional strings) — shared Jira label gate: **`runPipelineCi`** evaluates **`skipIfLabel`** via Jira before the step loop; if present on the ticket, the BA async segment is skipped. After a **complete** BA outcome, **`addLabel`** is applied on the Jira ticket.
- **`params.steps`** must be a non-empty array in **execution order**:
  1. **`ensure_jira_fields_expected`** (optional but recommended) — block empty descriptions.
  2. **`create_github_issue`** — creates the GitHub issue and sets the body to the **Jira context snapshot** only (marker `<!-- sdlc-agents:jira-context -->`). BA progress uses **comments**, not the description. Later steps read the snapshot from the issue body (or legacy comments) via the API.
  3. Step with **`async_call`** (e.g. **`async_operation`**) — when **`enabled`: true**, Codex/BA runs in the consumer workflow named by **`async_call.workflowFile`** (see `business-analyst.yml`). AI Teammate does not run the BA LLM inline.
  4. **`apply_ba_outcome`** — on **resume** after the child, reads Codex output and updates Jira/GitHub.
  5. Optional **`async_terminal_operation`** (e.g. `speckit-developer-agent.yml`) — terminal handoff (no parent resume).

## Consumer setup

1. Copy **`ai-teammate.config`** (and this README if you want) into the same path in your repo, e.g. `config/workflows/ai-teammate/`.
2. Point **Scrum Master** rules at that path (`configFile` in `scrum-master.config`).
3. Ensure secrets **`COPILOT_PAT`**, **`OPENAI_API_KEY`**, and Jira secrets match what `_reusable-ai-teammate.yml` expects.
4. Install the consumer workflow from **`.github/consumer-templates/ai-teammate.yml`** (or equivalent) calling the reusable workflow with `secrets: inherit`.
5. If you use async Codex, keep **`.github/consumer-templates/business-analyst.yml`** in sync with SDLCAgents: Codex paths come only from **`invocation-handoff-manifest.json`** in the prepare artifact (parent dispatch does not send per-file path inputs). The Codex model is read from **`config/workflows/business-analyst/business-analyst.config`** (`model`), then optional **`BA_MODEL`** (legacy **`BA_CODEX_MODEL`**), then **`o4-mini`**.

## Async invocation `contract` (artifact-only, agent-agnostic)

On the step that declares **`async_call`**, optional **`contract`** describes **artifact files** under **`async-invocation-handoff/<issueKey>/`** (same tree the prepare job zips into **`caller-handoff_input`**).

- **`inputParams`** — map of **logical name →** `{ "kind": "artifact", "scope": "handoff_workspace", "relativePath": "..." }`. Omitted keys inherit defaults (`prompt`, `jiraContext`). Extra keys are allowed in the type system; **Codex BA prepare** currently only materializes **`prompt`** and **`jiraContext`** (see `assertBaCodexPrepareContract` in `agent-invocation-contract.ts`).
- **`outputParams`** — same shape for outputs. If you **set** `outputParams` in JSON, it **replaces** the default map entirely (you must list every output artifact, e.g. your primary file). If you **omit** `outputParams`, defaults apply (`resultState` → `invocation-output.txt`).
- **`primaryOutputKey`** (optional) — which `outputParams` key becomes `codexRelativeOutputPath` in `ba-codex-state.json` and the Codex `output-file`. If omitted, **`resultState`** is used when present; otherwise the sole output key must be unambiguous.

### How it works

1. **Parent (`_reusable-ai-teammate`)** — TypeScript **`prepareCodexBaArtifacts`** (async handoff) writes the **BA** inputs (defaults):
   - **`inputParams.prompt`** — full LLM instructions + embedded ticket block.
   - **`inputParams.jiraContext`** — Markdown ticket snapshot for tools that read files instead of Jira APIs.
   - Internal **`ba-codex-state.json`** records `codexRelativeOutputPath` for the resolved primary output.
2. **`verify-invocation-handoff-ci.ts`** (parent) — asserts **every** **`contract.inputParams`** file exists and is non-empty before upload.
3. **Upload** — `actions/upload-artifact` sends the **entire** `async-invocation-handoff/<concurrency_key>/` directory, so **every** declared input artifact is included (plus internal JSON).
4. **Consumer (`business-analyst.yml`)** — downloads the bundle into **`async-invocation-handoff/<key>/`**, reads **`invocation-handoff-manifest.json`** for relative paths, verifies input artifacts exist, then **`_reusable-codex-run`** using those paths for prompt and primary output.

Types and parsing: `src/lib/agent-invocation-contract.ts`. Omit **`contract`** to use defaults (`invocation-prompt.md`, `invocation-jira-context.md`, `invocation-output.txt`).

## Local dry run

From the SDLCAgents repo (with a matching `config/` layout and mocks), **`npm run ai-teammate:debug`** runs **`runPipelineCi`** with mocked Jira/GitHub (may stop at async boundary depending on config).
