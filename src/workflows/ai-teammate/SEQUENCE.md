# AI Teammate — text sequence (GitHub Actions)

High-level order when the consumer repo calls `_reusable-ai-teammate.yml`.  
Implementation: `ai-teammate-agent.ts`, `ai-teammate-codex-ba-prepare.ts`, `ai-teammate-codex-ba-finish.ts`, `ai-teammate-codex-ba-shared.ts` (barrel: `ai-teammate-codex-ba.ts`), shared skip-if-label (`lib/agent-skip-if-label.ts`, CI entry `check-ba-skip-label-ci.ts`), `.github/workflows/_reusable-ai-teammate.yml`.

```
[Optional] Scrum Master (Jira rules)
    |
    | workflow_dispatch + caller_config, concurrency_key, config_file
    v
+-------------------------------------------------------------------+
| Job: Create GitHub issue and prepare BA                           |
+-------------------------------------------------------------------+
    |
    |-- checkout consumer repo + SDLCAgents (scripts)
    |-- check spec-kit / agent files exist
    |-- npm ci (.sdlc-agents)
    |
    |-- TS: check-ba-skip-label-ci -> lib/agent-skip-if-label (Jira vs skipIfLabel) -> output skip_reason (empty = run BA; non-empty = skip)
    |
    |-- TS: pipeline_ci (config-driven)
    |       Runs Jira validate / read context
    |       GitHub: Jira snapshot in issue body (create_github_issue)
    |       GitHub: create Issue (title + Jira snapshot body, jira:KEY label)
    |       If skip_reason empty: prepares BA invocation artifacts (prompt/context/state)
    |
    |-- shell ba_flags: if skip_reason non-empty -> run_codex=false else true
    |-- upload artifacts (async-invocation-handoff/<KEY>/ …)
    v
+-------------------------------------------------------------------+
| Job: ba_codex  (only if run_codex == true)                        |
|   openai/codex-action: read prompt -> invocation-output.txt      |
|   upload post-codex artifact                                     |
+-------------------------------------------------------------------+
    |
    v
+-------------------------------------------------------------------+
| Job: finish                                                        |
+-------------------------------------------------------------------+
    |
    |-- download prepare (+ post-codex if Codex ran)
    |-- TS: pipeline_ci (resume) (env AI_TEAMMATE_SKIP_BA_REASON = job output skip_reason)
    |       if skip_reason non-empty -> summary, stop (no state / no Codex apply)
    |       else read state + Codex output
    |       interpret BA JSON
    |       apply BA outcome (Jira comment/transition/labels; GitHub on incomplete)
    |       if BA complete -> pipeline continues
    |             -> update GitHub issue body (BA + Jira template)
    |             -> workflow_dispatch developer-agent.yml (step specify)
    |       if incomplete -> e.g. Jira Blocked, close GitHub issue not_planned
    v
Developer Agent (consumer)  -->  branch, draft PR, spec-kit steps, Copilot/Codex per config
    |
    v
PR merge flow (consumer pr-merged / Jira Done)  [optional, separate workflow]
```

## Actors (mental model)

| Actor | Role in this flow |
|-------|-------------------|
| **Jira** | Read/write in prepare and finish (per pipeline config). |
| **GitHub Issues** | Placeholder issue → comment → body update after BA; may close on incomplete BA. |
| **GitHub Actions + tsx** | `create_github_issue_and_prepare_ba` and `finish` jobs run the TypeScript agent. |
| **Codex** | Only in `ba_codex` (`openai/codex-action`). |
| **Developer agent + Copilot** | Optional terminal `async_call` can dispatch consumer `developer-agent.yml`. |

For Mermaid diagrams see repo `README.md` and `docs/pipeline-flow.md`.

---

## Codex BA files under `async-invocation-handoff/<JIRA_KEY>/` (how each is used)

These JSON/Markdown files are the **handoff between GitHub Actions jobs** (prepare → Codex → finish). They live on the runner under `async-invocation-handoff/<KEY>/`, then the **prepare** job uploads that folder as artifact **`caller-handoff_input`**. Later jobs **download** the same paths so `tsx` can read them again. They are **not** stored in the GitHub issue body; the issue description holds the Jira snapshot (from `create_github_issue`); BA progress is in **comments**. (Developer-agent may still use a separate `spec-output/<KEY>/issueContext.md` for spec-kit merge — that is unrelated to this async handoff tree.)

**Skip-by-label (Jira `skipIfLabel`)** does **not** use a file: step **`jira_ba_skip`** sets output **`skip_reason`** (`evaluateSkipIfLabel` in `lib/agent-skip-if-label.ts`, invoked from `check-ba-skip-label-ci.ts`). **Empty** = run BA; **non-empty** = skip BA prepare, set `run_codex=false`, and pass the same string to finish via job output **`skip_reason`** → env **`AI_TEAMMATE_SKIP_BA_REASON`** so the resume run exits early without `ba-codex-state.json`.

| File / output | Written by | Read by | Purpose |
|---------------|------------|---------|---------|
| **`skip_reason`** (job output) | `jira_ba_skip` step | `ba_flags`, finish env `AI_TEAMMATE_SKIP_BA_REASON` | Single string: empty = BA allowed; non-empty = skip BA/Codex/finish BA apply (reason text for logs / step summary). |
| **`invocation-prompt.md`** (contract default) | pipeline async handoff | `ba_codex` job (`openai/codex-action` **prompt-file**) | Full LLM prompt (paths overridable via async step **`contract`**). |
| **`invocation-jira-context.md`** (contract default) | pipeline async handoff | Any tool that needs ticket prose from the handoff bundle | Ticket / Jira context snapshot as a **file artifact** (artifact-only contract). |
| **`ba-codex-state.json`** | pipeline async handoff | pipeline resume | Checkpoint: `codexRelativeOutputPath` for **`invocation-output.txt`** (default), `agentLabelParams`, runner context, etc. |
| **`invocation-output.txt`** (contract default) | `ba_codex` (Codex **output-file**) | pipeline resume | Raw model reply; resume **parses** it. |

**Artifact chain (short):**

1. **Prepare** uploads `async-invocation-handoff/<KEY>/` (prep JSON; plus all **contract** input artifacts + state **when** `skip_reason` was empty). Parent runs **`verify-invocation-handoff-ci.ts`** before upload.
2. **`ba_codex`** downloads that artifact, verifies input files, runs Codex, writes **`invocation-output.txt`** (default), uploads **`caller-handoff_codex_output`** artifact.
3. **Finish** downloads **prepare** artifact again, then **post-codex** overlay when Codex succeeded, passes **`skip_reason`** into the resume run; TS reads **state** + **output** when BA ran, or exits early when **`AI_TEAMMATE_SKIP_BA_REASON`** is set.
