# SDLC Pipeline — C4 Architecture

---

## Level 1 — System Context

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   [Person]          [Person]                                                 │
│   Developer         Scrum Master                                             │
│      │                  │                                                    │
│      │ creates ticket   │ triggers pipeline                                  │
│      ▼                  ▼                                                    │
│                                                                              │
│   ┌──────────────────────────────┐                                           │
│   │   [Software System]          │◄── reads/writes tickets ──► Jira Cloud   │
│   │   SDLC Automation Pipeline   │◄── runs agents        ──► GitHub Copilot │
│   │                              │◄── manages code       ──► GitHub Repos   │
│   │   Automates the full dev     │◄── LLM analysis       ──► GitHub Models  │
│   │   lifecycle from Jira ticket │                             (GPT-4o)      │
│   │   to merged PR               │                                           │
│   └──────────────────────────────┘                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 2 — Containers

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  SDLC Automation Pipeline                                                                   │
│                                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────────────────────┐  │
│  │   [Container]         │    │   [Container]                                            │  │
│  │   Scrum Master        │───►│   AI Teammate                                            │  │
│  │                       │    │                                                          │  │
│  │   GitHub Actions      │    │   GitHub Actions  (workflow_dispatch)                    │  │
│  │   workflow_dispatch   │    │                                                          │  │
│  │                       │    │   Runs TypeScript pipeline (ai-teammate-agent.ts):       │  │
│  │   Scans Jira for      │    │   1. ensure_jira_fields_expected — validate description  │  │
│  │   tickets, dispatches │    │   2. create_github_issue — Jira snapshot in issue body   │  │
│  │   ai-teammate.yml     │    │   3. async_operation — handoff files → dispatch child     │  │
│  │   per ticket          │    │      (BA/Codex in business-analyst.yml / Codex action)    │  │
│  │                       │    │   4. apply_ba_outcome (resume) — interpret output, Jira/  │  │
│  │                       │    │      GitHub updates; optional async_terminal_operation    │  │
│  └──────────────────────┘    └──────────────────────────────┬───────────────────────────┘  │
│                                                              │ Copilot assigned             │
│                                                              ▼                              │
│                                               ┌──────────────────────┐                     │
│                                               │   [Container]         │                     │
│                                               │   Copilot Coding      │                     │
│                                               │   Agent               │◄── GitHub Models    │
│                                               │                       │    (GPT-4o)         │
│                                               │   GitHub Copilot      │    [External]       │
│                                               │   sdlc.pipeline       │                     │
│                                               │   .agent.md           │                     │
│                                               │                       │                     │
│                                               │   spec-kit steps +    │                     │
│                                               │   code implementation │                     │
│                                               └──────────┬────────────┘                     │
│                                                          │ opens PR                         │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │                                                      │
        ▼                                                      ▼
  ┌───────────┐                                       ┌───────────────┐
  │ Jira Cloud│                                       │  GitHub Repos  │
  │ [External]│                                       │  [External]    │
  └───────────┘                                       └───────────────┘
```

---

## Level 3 — Components (AI Teammate container)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  AI Teammate  (.github/workflows/_reusable-ai-teammate.yml)                              │
│                                                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Run ai-teammate-agent.ts  (src/workflows/ai-teammate/ai-teammate-agent.ts)        │  │
│  │                                                                                   │  │
│  │  decodeCallerConfig(CALLER_CONFIG) → issueKey + customParams                       │  │
│  │  runPipelineCi(deps)  → ai-teammate-pipeline.ts (config steps + async handoff)      │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: ensure_jira_fields_expected                                                │  │
│  │  src/workflows/ai-teammate/steps/ensure-jira-fields-expected.ts                   │  │
│  │                                                                                   │  │
│  │  getIssue(issueKey, ['summary','description'])                                    │  │
│  │  description present → continue                                                   │  │
│  │  description absent  → transitionIssueToStatusName() + addIssueComment() → stop  │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: create_github_issue                                                        │  │
│  │  src/workflows/ai-teammate/steps/create-github-issue.ts                           │  │
│  │                                                                                   │  │
│  │  ensure label "jira:{KEY}" exists                                                 │  │
│  │  octokit.rest.issues.create → empty body (title + jira:KEY label)                  │  │
│  │  ctx.githubIssueNumber ← new issue number                                         │  │
│  │  issues.update → marker + Jira snapshot markdown (jira-github-comment.ts)        │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: async_operation (async_call → business-analyst.yml)                        │  │
│  │  ai-teammate-codex-ba-prepare.ts — prepareCodexBaArtifacts                         │  │
│  │                                                                                   │  │
│  │  Writes async-invocation-handoff/<KEY>/* ; reusable workflow dispatches child.   │  │
│  │  Codex LLM runs in consumer workflow (not in ai-teammate-agent.ts).               │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │ resume after child                                       │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: apply_ba_outcome                                                           │  │
│  │  src/workflows/ai-teammate/steps/apply-ba-outcome.ts                              │  │
│  │                                                                                   │  │
│  │  interpretBaModelOutput() ← business-analyst/analyze-ticket.ts                    │  │
│  │  applyCodexBaOutcomeToJiraAndGithub()                                             │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Optional: async_terminal_operation (e.g. speckit-developer-agent.yml)            │  │
│  │  dispatch-pipeline-async-child-ci.ts — terminal child, no parent resume           │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 4 — Code (apply_ba_outcome + analyze-ticket)

```
  apply-ba-outcome.ts  (src/workflows/ai-teammate/steps/apply-ba-outcome.ts)
  │
  │  runApplyBaOutcome(ctx, step, deps)
  │
  │    read ba-codex-state.json + Codex primary output file (contract paths)
  │
  │    interpretBaModelOutput(codexOutput, ticketCtx)
  │      --> src/workflows/business-analyst/analyze-ticket.ts
  │            parseAnalysisResponse (JSON from Codex / model)
  │
  │    applyCodexBaOutcomeToJiraAndGithub(ctx, labels, deps, outcome)
  │      --> steps/apply-codex-ba-outcome-to-jira-github.ts
  │
  └── types: BaOutcome, BaAnalysisResult
        --> src/workflows/business-analyst/ba-types.ts

  (LLM call for BA happens in consumer Codex workflow, not in apply_ba_outcome.)
```

---

## Full End-to-End Flow

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  1. SCRUM MASTER                                                                      │
│                                                                                       │
│  - Loaded `params.steps` pipeline from scrum-master.config                              │
│  - Searched Jira for tickets with status "To Do"                                      │
│  - For each ticket:                                                                   │
│      - Updated Jira status: To Do → In Progress                                       │
│      - Added label "sm_triggered" to Jira ticket                                      │
│      - Dispatched ai-teammate workflow                                                │
└────────────────────────────┬──────────────────────────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  2. AI TEAMMATE  (single TypeScript pipeline run)                                     │
│                                                                                       │
│  Step: ensure_jira_fields_expected                                                    │
│  - Fetched Jira ticket; verified description is non-empty                             │
│  - (No description → transition to "In Review" + comment → stop)                     │
│                                                                                       │
│  Optional: speckit-developer-agent setup may write spec-output/{KEY}/issueContext.md  │
│  when Jira secrets are configured (spec-kit-context/issue-context.ts).               │
│                                                                                       │
│  Step: create_github_issue                                                            │
│  - Created GitHub issue "{KEY}: Copilot Coding Agent Task"                            │
│    (label: jira:{KEY}; body: Jira snapshot after marker — no BA-in-progress line)    │
│                                                                                       │
│  Step: async handoff + child BA/Codex (async_operation)                               │
│  - prepareCodexBaArtifacts → async-invocation-handoff/<KEY>/                         │
│  - Child workflow runs Codex; resume runs apply_ba_outcome                            │
│                                                                                       │
│  Optional: async_terminal_operation → speckit-developer-agent.yml                    │
└────────────────────────────┬──────────────────────────────────────────────────────────┘
                             │ Copilot assigned
                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  3. COPILOT CODING AGENT                                                              │
│                                                                                       │
│  - Read GitHub issue (specify → clarify → plan → tasks → implement)                   │
│  - Created feature branch                                                             │
│  - Wrote code and tests                                                               │
│  - Opened PR with label "jira:{KEY}"                                                  │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-end sequence (Mermaid)

The diagram below matches the **current** automation in this repository: `scrum-master` dispatches `ai-teammate` **at git ref `master`**, the pipeline runs `ai-teammate.config`, BA runs in an **async child** workflow (Codex), **`apply_ba_outcome`** interprets output on resume, and Copilot/spec-kit may follow per consumer config. `_reusable-pr-merged.yml` finishes Jira when the PR merges.

```mermaid
sequenceDiagram
    autonumber
    participant SM as Scrum Master<br/>(GitHub Actions)
    participant J as Jira
    participant AT as AI Teammate<br/>(ai-teammate-agent.ts)
    participant GH as GitHub Issue
    participant CX as Codex BA child<br/>(business-analyst.yml)
    participant COP as Copilot coding agent<br/>(sdlc.pipeline.agent.md)
    participant PR as GitHub PR
    participant PM as PR merged workflow<br/>(_reusable-pr-merged.yml)

    rect rgb(240, 248, 255)
        Note over SM,J: Scrum master (scrum-master-core): JQL + status filter; skip tickets with skipIfLabel
        SM->>J: Search issues
        SM->>SM: workflow_dispatch (per step: workflow_id on master + caller_config)
        SM->>J: transitionIssueToPostRead (POST_READ_STATUS env, default In Progress)
        SM->>J: addIssueLabel (addLabel from step, e.g. sm_triggered)
    end

    SM->>AT: workflow_dispatch with caller_config (issue key)

    rect rgb(255, 250, 240)
        Note over AT,J: ensure_jira_fields_expected
        AT->>J: getIssue(summary, description)
        alt description empty
            AT->>J: transition to onEmpty.status + comment<br/>(default In Review in repo config)
            AT--xAT: stop pipeline
        else description present
            AT->>GH: create_github_issue (Jira snapshot in body; BA progress via comments)
            rect rgb(220, 255, 220)
                Note over AT,CX: async_operation — handoff; skipIfLabel gate runs inside pipeline_ci
                AT->>AT: prepareCodexBaArtifacts → async-invocation-handoff/<KEY>/
                AT->>CX: workflow_dispatch child (business-analyst / Codex)
                CX-->>AT: invocation-output.txt (resume)
                AT->>AT: apply_ba_outcome — interpretBaModelOutput + Jira/GitHub
                alt BA complete (all required fields)
                    AT->>J: add label ba_analyzed (from config)
                    AT->>GH: optional comment: BA complete
                    Note over AT,GH: optional async_terminal_operation or Copilot on issue
                    COP->>PR: Open PR (e.g. label jira:KEY)
                    Note over PR: PR ready → human review / approve / merge
                else BA incomplete
                    AT->>J: addIssueComment(questions)
                    AT->>GH: comment + close placeholder issue
                    AT--xAT: stop pipeline
                end
            end
        end
    end

    rect rgb(245, 245, 255)
        Note over PM,J: After merge (consumer wires PR closed → reusable workflow)
        PM->>GH: Close linked issue if still open
        PM->>J: Transition to Done + Jira comment
    end
```
