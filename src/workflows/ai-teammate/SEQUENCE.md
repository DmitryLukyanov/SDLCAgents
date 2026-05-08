# AI Teammate — text sequence (GitHub Actions)

High-level order when the consumer repo calls `_reusable-ai-teammate.yml` (single job, multiple steps).

**Implementation:** `ai-teammate-agent.ts` → `runPipelineCi` (`ai-teammate-pipeline.ts`), `ai-teammate-codex-ba-prepare.ts`, `ai-teammate-codex-ba-shared.ts`, barrel `ai-teammate-codex-ba.ts`, skip gate `evaluateSkipIfLabelFromConfigFile` (`lib/agent-skip-if-label.ts`, called **inside** `runPipelineCi`), `.github/workflows/_reusable-ai-teammate.yml`.

```
[Optional] Scrum Master (Jira rules)
    |
    | workflow_dispatch + caller_config, concurrency_key, config_file
    v
+-------------------------------------------------------------------+
| Job: ai_teammate (_reusable-ai-teammate.yml)                      |
+-------------------------------------------------------------------+
    |
    |-- checkout consumer repo + SDLCAgents (scripts), npm ci
    |
    |-- TS: pipeline_ci (tsx ai-teammate-agent.ts)
    |       decodeCallerConfig, load agent JSON
    |       If fresh run: evaluateSkipIfLabelFromConfigFile → ctx.skipBaReason (optional)
    |       Run params.steps: ensure_jira_fields_expected, create_github_issue, …
    |       At async_call step: prepareCodexBaArtifacts → handoff under async-invocation-handoff/<KEY>/
    |       Set job outputs (needs_async_handoff, async_handoff) when dispatching child
    |
    |-- If needs_async_handoff: verify-invocation-handoff-ci.ts, upload artifacts,
    |       dispatch-pipeline-async-child-ci.ts (consumer BA/Codex workflow)
    |
    |-- Resume: when caller_config.params.async_child_run_id is set, YAML downloads
    |       parent + child artifacts first; same pipeline_ci step continues the loop
    |       from async_trigger_step (apply_ba_outcome, optional terminal async_call, …)
    v
Developer Agent (consumer, optional terminal async_call)  -->  PR, spec-kit, Copilot per config
    |
    v
PR merge flow (consumer pr-merged / Jira Done)  [optional, separate workflow]
```

## Actors (mental model)

| Actor | Role in this flow |
|-------|-------------------|
| **Jira** | Read/write in pipeline steps (per config). |
| **GitHub Issues** | Placeholder issue → Jira snapshot in body; BA progress may use comments. |
| **GitHub Actions + tsx** | `ai-teammate-agent.ts` runs the unified pipeline; child workflow runs Codex. |
| **Codex / BA** | In consumer `business-analyst.yml` (or other `async_call.workflowFile`). |
| **SpecKit Developer Agent** | Optional terminal `async_call` can dispatch `speckit-developer-agent.yml`. |

For Mermaid diagrams see repo `README.md` and `docs/pipeline-flow.md`.

---

## Codex BA files under `async-invocation-handoff/<JIRA_KEY>/`

Handoff between parent job steps and the async child. The **prepare** phase uploads **`caller-handoff_input`**; the child uploads **`caller-handoff_codex_output`** when Codex completes.

**Skip-by-label:** evaluated in **`runPipelineCi`** (not a separate workflow step). If the ticket has **`params.skipIfLabel`**, **`ctx.skipBaReason`** is set; the async BA segment is skipped and **`AI_TEAMMATE_SKIP_BA_REASON`** may propagate where the workflow sets it.

| File / output | Written by | Read by | Purpose |
|---------------|------------|---------|---------|
| **`invocation-prompt.md`** (default) | async handoff prepare | child Codex job | LLM prompt (overridable via **`contract`**). |
| **`invocation-jira-context.md`** (default) | async handoff prepare | child | Ticket snapshot file. |
| **`ba-codex-state.json`** | async handoff prepare | pipeline resume | Checkpoint + `codexRelativeOutputPath`, labels, runner ctx. |
| **`invocation-output.txt`** (default) | Codex child | **`apply_ba_outcome`** | Raw model reply. |

**Artifact chain (short):**

1. **Prepare** (same job): pipeline writes `async-invocation-handoff/<KEY>/`, then **`verify-invocation-handoff-ci.ts`**, upload, **`dispatch-pipeline-async-child-ci.ts`**.
2. **Child** runs Codex, writes **`invocation-output.txt`**, uploads post-Codex artifact.
3. **Resume** invocation: downloads artifacts, **`pipeline_ci`** continues from **`async_trigger_step`** → **`apply_ba_outcome`**, then any tail steps.
