# SDLCAgents

## Open Questions / Concerns / TODO

| Priority | # | Topic | Description |
|----------|---|-------|-------------|
| 🔴 Critical | 1 | **Human-in-the-loop option** | Answer questions from the model if any, and add an optional approval gate before implementation starts — post a summary comment on the PR/issue and wait for explicit approval before the Copilot agent proceeds |
| 🔴 Critical | 2 | **More complex prompts** | Invest in richer, more detailed prompts for each agent step — better context injection, chain-of-thought guidance, domain-specific instructions, and example-driven few-shot patterns to improve output quality |
| 🔴 Critical | 3 | **Lock on GitHub** | Prevent concurrent Copilot agent runs on the same issue/branch (GitHub concurrency groups help but need a more robust distributed lock strategy) |
| 🟠 High | 4 | **Lightweight pipeline (no spec-kit)** | For simpler tickets that don't need the full specify→clarify→plan→tasks→implement ceremony, support a lightweight mode that goes straight to implementation |
| 🟠 High | 5 | **Solve merge conflicts** | Automatically detect and resolve merge conflicts on Copilot branches — rebase against master, apply conflict resolution heuristics, and re-run tests before marking the PR as ready |
| 🟡 Medium | 6 | **More complex routing** | Smarter scrum master routing: route by ticket type, priority, team, component, or estimated complexity rather than simple label-based rules |
| 🟡 Medium | 7 | **Use different agents** | Support pluggable implementer agents — Claude Code, OpenAI Codex, GitHub Copilot — switchable via config without changing pipeline code |
| 🟡 Medium | 8 | **Choose different AI models** | Allow per-step or per-workflow model selection (e.g. GPT-4o for BA analysis, Claude for implementation, smaller/cheaper models for low-stakes steps) |
| 🟢 Low | 9 | **More agents** | Expand the agent roster: security reviewer, performance profiler, documentation generator, test coverage enforcer, dependency auditor |
| 🟢 Low | 10 | **More sources than just Jira** | Support additional ticket sources: GitHub Issues native, Azure DevOps, Linear, Shortcut — with a pluggable source adapter interface |

---

## Consumer Repo Setup Checklist

When onboarding a new repository to use the SDLC pipeline, ensure the following are in place:

| # | What | Where | Notes |
|---|------|-------|-------|
| 1 | `COPILOT_PAT` secret | Repo → Settings → Secrets | Classic PAT — see scopes below |
| 2 | `.github/workflows/copilot-setup-steps.yml` | Must install `powershell` | Spec-kit scripts use `pwsh` — missing this means spec artifacts are never written to disk |
| 3 | `.specify/` directory | Repo root | Spec-kit CLI scaffolding — copy from a reference repo or run `specify init --here` |
| 4 | `.github/agents/` | All `speckit.*.agent.md` files | Copilot sub-agent definitions |
| 5 | `.github/prompts/` | All `speckit.*.prompt.md` files | Prompt templates |
| 6 | `config/spec-kit/constitution.md` | Repo root | Project-specific guidelines for the BA and spec agents |
| 7 | `config/spec-kit/defaults.json` | Repo root | Global directive and defaults |
| 8 | `config/workflows/` | `ai-teammate/`, `business-analyst/`, `scrum-master/` configs | Update Jira project key in JQL |

> **PowerShell note:** `copilot-setup-steps.yml` must include an `Install PowerShell` step (`sudo apt-get install -y powershell`). Without it, the spec-kit scripts silently fail and no spec artifacts (`specs/<branch>/`) are committed during the pipeline run.

---

## GitHub Secrets — Required PAT

The workflows require a **GitHub Classic PAT** stored as the `COPILOT_PAT` repository secret.

> Fine-grained PATs are **not supported** — GitHub does not allow cross-repository `workflow_dispatch` triggers with fine-grained tokens.

| Scope | Why it is needed |
|-------|-----------------|
| `repo` | Read/write issues, labels; trigger `workflow_dispatch` within the repo |
| `workflow` | Trigger `workflow_dispatch` events on GitHub Actions workflows |
| `read:org` | Verify that `copilot-swe-agent[bot]` is a valid assignee within the organisation |

`write:org` is **not** required — assigning the bot to an issue is a repo-level write operation covered by `repo`, not an org-level mutation.

---

## AI Teammate — Issue & Agent Flow

```mermaid
sequenceDiagram
    participant AT  as AI Teammate<br/>(_reusable-ai-teammate.yml)
    participant GH  as GitHub Issues API
    participant BA  as BA Sub-issue Handler<br/>(ba-subissue.yml)
    participant COP as Copilot Coding Agent<br/>(sdlc.pipeline)

    Note over AT: Step 5 — ai-teammate-agent.ts<br/>runPipeline: prepareSpecKitWorkspace<br/>(manifest+context if cliEnabled),<br/>then runTicketProcessor (log Jira)

    Note over AT: Step 6 — reads manifest<br/>extracts issue_key, context_file

    AT->>GH: POST /issues<br/>title: "{KEY}: Copilot Coding Agent Task"<br/>body: "⏳ BA analysis in progress..."<br/>label: jira:{KEY}
    GH-->>AT: parent_issue_number, parent_id

    AT->>GH: POST /issues<br/>title: "{KEY}: BA Analysis"<br/>label: ba-analysis
    GH-->>AT: ba_issue_number, ba_issue_id

    AT->>GH: POST /issues/{parent}/sub_issues<br/>sub_issue_id: ba_issue_id
    Note over GH: BA sub-issue linked<br/>as child of parent

    GH-)BA: label "ba-analysis" event<br/>triggers ba-subissue.yml

    Note over AT: Step B — polls every 30s<br/>GET /issues/{ba_number}<br/>waiting for state == "closed"

    BA->>BA: Fetch Jira data
    BA->>BA: Call GPT-4o
    BA->>GH: POST comment with BA result JSON
    BA->>GH: PATCH /issues/{ba_number} state=closed
    BA->>BA: Add label ba_analyzed to Jira

    GH-->>AT: state == "closed" ✅

    Note over AT: Step C — reads BA result comment<br/>extracts JSON between markers

    alt BA complete
        Note over AT: Step 7 — builds Copilot prompt<br/>injects BA fields into template

        AT->>GH: PATCH /issues/{parent_number}<br/>body: full Copilot prompt<br/>assignees: copilot-swe-agent[bot]<br/>agent_assignment: sdlc.pipeline
        GH-->>COP: issue assigned → agent starts

        COP->>COP: spec-kit workflow<br/>(specify→clarify→plan→tasks→implement)
        COP->>COP: code review loop
        COP->>GH: gh pr ready
    else BA incomplete or timed out
        AT->>GH: PATCH /issues/{parent_number}<br/>state=closed, reason=not_planned
        Note over AT: Jira ticket → Blocked
    end
```

---

## Sequential Flow

```mermaid
sequenceDiagram
    autonumber

    participant SM  as Scrum Master
    participant AT  as AI Teammate
    participant BA  as BA Sub-issue Handler
    participant COP as Copilot Agent
    participant MR  as PR Merged

    SM->>SM: Load rules from scrum-master.config
    SM->>SM: Search Jira for tickets (To Do)
    SM->>SM: Update Jira status: To Do → In Progress
    SM->>SM: Add label sm_triggered to Jira
    SM->>AT: Dispatch ai-teammate workflow

    AT->>AT: Prepare spec-kit workspace (Node pipeline)
    AT->>AT: Read manifest
    AT->>AT: Create parent GitHub issue
    AT->>AT: Create BA sub-issue (label: ba-analysis)
    AT->>AT: Link BA sub-issue as child of parent
    AT-)BA: label ba-analysis triggers ba-subissue.yml

    BA->>BA: Read Jira ticket (summary, description, comments)
    BA->>BA: Read related Jira tickets
    BA->>BA: Call GPT-4o to analyze requirements
    BA->>BA: Post BA result comment to sub-issue
    BA->>BA: Add label ba_analyzed to Jira ticket
    BA->>BA: Post BA result comment to Jira ticket
    BA->>AT: Close BA sub-issue

    AT->>AT: Poll until sub-issue closed (every 30s, up to 20 min)
    AT->>AT: Read BA result from sub-issue comment

    alt BA complete
        AT->>AT: Build Copilot prompt from BA result
        AT->>AT: Update parent issue with full prompt
        AT->>COP: Assign Copilot agent (sdlc.pipeline)

        COP->>COP: Read parent issue
        COP->>COP: Create feature branch
        COP->>COP: Write code and tests
        COP->>COP: Code review
        COP->>COP: Mark PR as ready
        COP->>MR: PR ready for review (human approves & merges)

    else BA incomplete or timed out
        AT->>AT: Post clarification questions to Jira
        AT->>AT: Update Jira status: In Progress → Blocked
        AT->>AT: Close parent GitHub issue as not planned
    end

    MR->>MR: PR approved and merged (manual)
    MR->>MR: Close linked GitHub issue
    MR->>MR: Update Jira status: In Progress → Done
```

---

## Pipeline Flow (flowchart)

```mermaid
flowchart TD
    %% ── Scrum Master ──────────────────────────────────────────────
    subgraph SM [" 🔁  Scrum Master — scrum-master.yml"]
        SM1[Load rules from scrum-master.config]
        SM2[Search Jira for tickets\nwith status 'To Do']
        SM3[Update Jira status:\nTo Do → In Progress]
        SM4[Add label 'sm_triggered'\nto Jira ticket]
        SM5[Dispatch ai-teammate workflow]
        SM1 --> SM2 --> SM3 --> SM4 --> SM5
    end

    %% ── AI Teammate — pre-BA ──────────────────────────────────────
    subgraph AT_PRE [" 🤖  AI Teammate — ai-teammate.yml (Steps 5, 6, A)"]
        AT2[prepareSpecKitWorkspace +\nrunTicketProcessor]
        AT3[Read manifest:\nissue key, context file]
        AT4[Create GitHub issue:\nparent placeholder]
        AT5[Create GitHub sub-issue:\nBA Analysis]
        AT6[Link BA sub-issue\nas child of parent]
        AT2 --> AT3 --> AT4 --> AT5 --> AT6
    end

    SM5 --> AT2

    %% ── BA Sub-issue Handler ──────────────────────────────────────
    subgraph BA [" 🔍  BA Sub-issue Handler — ba-subissue.yml"]
        BA2[Read Jira ticket:\nsummary, description, comments]
        BA3[Read related Jira tickets]
        BA4[Call GPT-4o to analyze\nticket requirements]
        BA5[Post BA result comment\nto sub-issue]
        BA6[Close BA sub-issue]
        BA2 --> BA3 --> BA4 --> BA5 --> BA6
    end

    AT6 -- "label 'ba-analysis'\ntriggers ba-subissue.yml" --> BA2

    %% ── AI Teammate — poll & route ────────────────────────────────
    subgraph AT_POLL [" 🤖  AI Teammate — Steps B, C"]
        POLL[Poll BA sub-issue state every 30s\nuntil closed or 20 min timeout]
        READ[Read BA result from\nsub-issue comment]
        ROUTE{BA result?}
        POLL --> READ --> ROUTE
    end

    BA6 --> POLL

    %% ── Incomplete path ───────────────────────────────────────────
    subgraph BLOCKED [" 🚫  Blocked"]
        BLOCK1[Add clarification questions\nas Jira comment]
        BLOCK2[Update Jira status:\nIn Progress → Blocked]
        BLOCK3[Add label 'ba_analyzed'\nto Jira ticket]
        BLOCK4[Close parent GitHub issue\nas not planned]
        END_BLOCK([End])
        BLOCK1 --> BLOCK2 --> BLOCK3 --> BLOCK4 --> END_BLOCK
    end

    ROUTE -- "BA incomplete\nor timed out" --> BLOCK1

    %% ── AI Teammate — post-BA ─────────────────────────────────────
    subgraph AT_POST [" 🤖  AI Teammate resumed — Steps 7, 8"]
        AT8[Build Copilot prompt\nfrom BA result]
        AT9[Update parent GitHub issue\nwith full Copilot prompt]
        AT10[Assign Copilot coding agent\nsdlc.pipeline]
        AT8 --> AT9 --> AT10
    end

    ROUTE -- "BA complete" --> AT8

    %% ── Copilot Coding Agent ──────────────────────────────────────
    subgraph COP [" 💻  Copilot Coding Agent — sdlc.pipeline.agent.md"]
        COP2[Read parent issue\nspecify → clarify → plan → tasks → implement]
        COP3[Create feature branch]
        COP4[Write code and tests]
        COP5[Code review]
        COP6[Open draft PR]
        COP2 --> COP3 --> COP4 --> COP5 --> COP6
    end

    AT10 --> COP2

    %% ── Mark PR Ready ─────────────────────────────────────────────
    subgraph MR [" ✅  PR Merged — pr-merged.yml"]
        MR2[Close parent GitHub issue]
        MR3[Update Jira status:\nIn Progress → Done]
        END_OK([End])
        MR2 --> MR3 --> END_OK
    end

    COP6 --> MR2

    %% ── Subgraph styles ───────────────────────────────────────────
    style SM       fill:#e8f5e9,stroke:#43a047,color:#1b5e20
    style AT_PRE   fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
    style BA       fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    style AT_POLL  fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
    style BLOCKED  fill:#fce4ec,stroke:#e53935,color:#b71c1c
    style AT_POST  fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
    style COP      fill:#e0f7fa,stroke:#00acc1,color:#006064
    style MR       fill:#e8f5e9,stroke:#43a047,color:#1b5e20

    %% ── Node styles ───────────────────────────────────────────────
    classDef action fill:#fff,stroke:#90a4ae,color:#263238
    classDef decision fill:#fff8e1,stroke:#f9a825,color:#33691e
    classDef terminal fill:#ef9a9a,stroke:#e53935,color:#b71c1c,font-weight:bold

    class SM1,SM2,SM3,SM4,SM5,AT2,AT3,AT4,AT5,AT6,BA2,BA3,BA4,BA5,BA6,POLL,READ,AT8,AT9,AT10,COP2,COP3,COP4,COP5,COP6,MR2,MR3,BLOCK1,BLOCK2,BLOCK3,BLOCK4 action
    class ROUTE decision
    class END_BLOCK,END_OK terminal
```
