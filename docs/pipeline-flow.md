# SDLC Pipeline — C4 Architecture

---

## Level 1 — System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   [Person]          [Person]                                            │
│   Developer         Scrum Master                                        │
│      │                  │                                               │
│      │ creates ticket   │ triggers pipeline                             │
│      ▼                  ▼                                               │
│                                                                         │
│   ┌──────────────────────────────┐                                      │
│   │   [Software System]          │                                      │
│   │   SDLC Automation Pipeline   │◄── reads tickets ──► Jira Cloud     │
│   │                              │◄── runs agents  ──► GitHub Copilot  │
│   │   Automates the full dev     │◄── manages code ──► GitHub Repos    │
│   │   lifecycle from Jira ticket │                                      │
│   │   to merged PR               │                                      │
│   └──────────────────────────────┘                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Level 2 — Containers

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SDLC Automation Pipeline                                                           │
│                                                                                     │
│  ┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐  │
│  │   [Container]        │     │   [Container]        │     │   [Container]        │  │
│  │   Scrum Master       │────►│   AI Teammate        │────►│   Mark PR Ready      │  │
│  │                      │     │                      │     │                      │  │
│  │   GitHub Actions     │     │   GitHub Actions     │     │   GitHub Actions     │  │
│  │   workflow_dispatch  │     │   workflow_dispatch  │     │   workflow_run        │  │
│  │                      │     │                      │     │                      │  │
│  │   Scans Jira for     │     │   Runs Node.js       │     │   Approves, merges   │  │
│  │   To Do tickets,     │     │   pipeline + hands   │     │   PR, closes issue,  │  │
│  │   dispatches work    │     │   off to Copilot     │     │   updates Jira       │  │
│  └─────────────────────┘     └──────────┬──────────┘     └──────────────────────┘  │
│            │                            │                           ▲               │
│            │                            │                           │               │
│            ▼                            ▼                           │               │
│  ┌─────────────────────┐     ┌─────────────────────┐               │               │
│  │   [Container]        │     │   [Container]        │               │               │
│  │   Node.js Scripts    │     │   Copilot Coding     │───────────────┘               │
│  │                      │     │   Agent              │  opens PR / completes         │
│  │   TypeScript / tsx   │     │                      │                               │
│  │                      │     │   GitHub Copilot     │                               │
│  │   Pipeline logic,    │     │   .agent.md prompts  │                               │
│  │   Jira client,       │     │                      │                               │
│  │   spec-kit prep      │     │   spec-kit steps +   │                               │
│  │                      │     │   code implementation│                               │
│  └─────────────────────┘     └─────────────────────┘                               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
  ┌───────────┐                           ┌───────────────┐
  │ Jira Cloud│                           │  GitHub Repos  │
  │ [External]│                           │  [External]    │
  └───────────┘                           └───────────────┘
```

---

## Level 3 — Components (AI Teammate container)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AI Teammate (GitHub Actions + Node.js)                                          │
│                                                                                  │
│  ┌────────────────┐    ┌──────────────────────────────────────────────────────┐ │
│  │  [Component]   │    │  [Component]                                          │ │
│  │  agent-runner  │───►│  pipeline runner          src/runners/pipeline.ts    │ │
│  │  .ts           │    │                                                       │ │
│  │                │    │  ┌────────────────────────────────────────────────┐  │ │
│  │  Entry point.  │    │  │  Step 1: check_description                     │  │ │
│  │  Reads agent   │    │  │  src/runners/check-description.ts              │  │ │
│  │  JSON config,  │    │  │                                                 │  │ │
│  │  resolves      │    │  │  • getIssue() → check description field        │  │ │
│  │  runner type   │    │  │  • empty → transitionIssue() + addComment()    │  │ │
│  │                │    │  │  • returns STOP or CONTINUE                     │  │ │
│  └────────────────┘    │  └────────────────────────────────────────────────┘  │ │
│                        │                       │ CONTINUE                      │ │
│                        │                       ▼                               │ │
│                        │  ┌────────────────────────────────────────────────┐  │ │
│                        │  │  Step 2: dummy_ticket                           │  │ │
│                        │  │  src/runners/pipeline.ts                        │  │ │
│                        │  │                                                 │  │ │
│                        │  │  • runSpecKitPipelineWithLogging()              │  │ │
│                        │  │    writes context.md, manifest.json to disk    │  │ │
│                        │  │  • runDummyTicketAgent()                        │  │ │
│                        │  │    transitions Jira → "In Progress"             │  │ │
│                        │  │  • returns CONTINUE                             │  │ │
│                        │  └────────────────────────────────────────────────┘  │ │
│                        │                       │ CONTINUE                      │ │
│                        │                       ▼                               │ │
│                        │  ┌────────────────────────────────────────────────┐  │ │
│                        │  │  Step 3: confirmation                           │  │ │
│                        │  │  src/runners/confirmation.ts                    │  │ │
│                        │  │                                                 │  │ │
│                        │  │  • prints "✅ Pipeline complete for <key>"      │  │ │
│                        │  │  • returns CONTINUE                             │  │ │
│                        │  └────────────────────────────────────────────────┘  │ │
│                        └──────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────┐    ┌──────────────────┐    ┌───────────────────────────┐   │
│  │  [Component]   │    │  [Component]      │    │  [Component]               │   │
│  │  bash: read    │    │  bash: build      │    │  bash: create issue        │   │
│  │  manifest.json │───►│  Copilot prompt   │───►│  assign copilot-swe-agent  │   │
│  │                │    │                   │    │                             │   │
│  │  reads disk    │    │  reads context.md │    │  gh issue create            │   │
│  │  outputs.*     │    │  from disk        │    │  gh api assign              │   │
│  └────────────────┘    └──────────────────┘    └───────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 4 — Code (pipeline runner internals)

```
  agent-runner.ts
  │
  │  main()
  │    reads CONFIG_FILE → AgentJson
  │    sets process.env.ISSUE_KEY
  │    resolves runner = agent.params.runner
  │
  │    switch (runner):
  │      "dummy_ticket" ──► runDummyTicketAgent()
  │      "pipeline"     ──► runPipeline(issueKey, steps)  ◄─── src/runners/pipeline.ts
  │
  └── runPipeline(issueKey: string, steps: PipelineStep[])
        ctx = { issueKey }
        for each step:
          outcome = executeStep(ctx, step)
          if outcome.status === 'stop' → return   (pipeline halts)
          if outcome.status === 'continue' → next step

        executeStep(ctx, step):
          switch (step.runner):
            'check_description' ──► runCheckDescription(ctx, step)
            │                         getIssue()
            │                         adfToPlain(description)
            │                         if empty:
            │                           transitionIssueToStatusName()
            │                           addIssueComment()
            │                           return { status: 'stop' }
            │                         return { status: 'continue' }
            │
            'dummy_ticket' ──────────► runSpecKitPipelineWithLogging()
            │                           prepareSpecKitContext()
            │                             getIssue()
            │                             writes manifest.json  ──► disk
            │                             writes context.md     ──► disk
            │                         runDummyTicketAgent()
            │                           getIssue()
            │                           transitionIssueToStatusName()
            │                           addIssueComment()
            │                         return { status: 'continue' }
            │
            'confirmation' ──────────► runConfirmation(ctx, step)
                                        console.log("✅ Pipeline complete...")
                                        return { status: 'continue' }
```
