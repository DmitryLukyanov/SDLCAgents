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
│  │   tickets, dispatches │    │   2. print_jira_context_to_stdout — spec-kit workspace   │  │
│  │   ai-teammate.yml     │    │   3. create_github_issue — placeholder issue             │  │
│  │   per ticket          │    │   4. run_ba_inline — GPT-4o analysis inline              │  │
│  │                       │    │      complete → continue                                 │  │
│  │                       │    │      incomplete → block Jira, close issue, stop          │  │
│  │                       │    │   5. assign_copilot — fill template, assign Copilot      │  │
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
│  │  decodeEncodedConfig(ENCODED_CONFIG) → issueKey + customParams                    │  │
│  │  runPipeline(issueKey, steps, deps)  → ai-teammate-pipeline.ts                    │  │
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
│  │  Step: print_jira_context_to_stdout                                               │  │
│  │  src/workflows/ai-teammate/steps/print-jira-context-to-stdout.ts                  │  │
│  │                                                                                   │  │
│  │  prepareSpecKitWorkspace() → spec-output/{key}/                                   │  │
│  │    cliEnabled=true  → manifest.json + context.md + constitution.md                │  │
│  │    cliEnabled=false → constitution.md + spec.md + plan.md + tasks.md              │  │
│  │  ctx.specKitContextFile ← spec-output/{key}/context.md                            │  │
│  │  runPrintJiraContextToStdout() — logs Jira fields + related tickets to stdout     │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: create_github_issue                                                        │  │
│  │  src/workflows/ai-teammate/steps/create-github-issue.ts                           │  │
│  │                                                                                   │  │
│  │  ensure label "jira:{KEY}" exists                                                 │  │
│  │  octokit.rest.issues.create → "⏳ BA analysis in progress..."                     │  │
│  │  ctx.githubIssueNumber ← new issue number                                         │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │                                                          │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: run_ba_inline                                                              │  │
│  │  src/workflows/ai-teammate/steps/run-ba-inline.ts                                 │  │
│  │                                                                                   │  │
│  │  getIssue() + adfToPlain()             ← jira-client.ts / adf-to-plain.ts        │  │
│  │  extractComments() + mapRelated()      ← business-analyst-core.ts                │  │
│  │  fetchRelatedIssueSummaries()          ← jira-related.ts                         │  │
│  │  analyzeTicket(ctx, token, model)      ← analyze-ticket.ts → GPT-4o              │  │
│  │                                                                                   │  │
│  │  complete   → ctx.baOutcome ← outcome → continue                                 │  │
│  │  incomplete → addIssueComment(questions)                                          │  │
│  │               transitionIssueToStatusName("Blocked")                              │  │
│  │               closeGithubIssue(githubIssueNumber) → stop                          │  │
│  └────────────────────────────┬──────────────────────────────────────────────────────┘  │
│                               │ BA complete                                              │
│                               ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Step: assign_copilot                                                             │  │
│  │  src/workflows/ai-teammate/steps/assign-copilot.ts                                │  │
│  │                                                                                   │  │
│  │  read config/spec-kit/defaults.json → global directive                            │  │
│  │  read ctx.specKitContextFile (context.md) → {{JIRA_CONTEXT}}                     │  │
│  │  fill src/workflows/ai-teammate/templates/github-issue-with-copilot.md            │  │
│  │  updateGithubIssue(issueNumber, {                                                 │  │
│  │    body: filledTemplate,                                                          │  │
│  │    assignees: ['copilot-swe-agent[bot]'],                                         │  │
│  │    agentInstructions: "add label jira:{KEY} to PR..."                             │  │
│  │  }) → Copilot runs sdlc.pipeline.agent.md, opens PR                               │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 4 — Code (run-ba-inline.ts + analyze-ticket.ts)

```
  run-ba-inline.ts  (src/workflows/ai-teammate/steps/run-ba-inline.ts)
  │
  │  runBaInline(ctx, deps)
  │
  │    deps.getIssue(issueKey, fields)
  │      --> src/lib/jira/jira-client.ts  jiraFetch( GET /rest/api/3/issue/{key} )
  │
  │    adfToPlain(fields.description | comment.body)
  │      --> src/lib/adf-to-plain.ts
  │
  │    extractComments(issue)           ← business-analyst-core.ts
  │      filters BA-generated vs user comments (isBAGeneratedComment flag)
  │      presents user replies as "User Answers to BA Questions"
  │
  │    deps.fetchRelatedIssueSummaries(issueKey, depth)
  │      --> src/lib/jira/jira-related.ts
  │            searchIssues(`issue in linkedIssues("KEY")`)
  │            searchIssues(`parent = KEY`)
  │
  │    mapRelated(related)              ← business-analyst-core.ts
  │
  │    deps.analyzeTicket(ctx, githubToken, model)
  │      --> src/workflows/business-analyst/analyze-ticket.ts
  │            buildPrompt(ctx)
  │            callGitHubModels(prompt, token)
  │              POST https://models.github.ai/inference/chat/completions
  │              model: openai/gpt-4o, temperature: 0.1
  │              response_format: { type: "json_object" }
  │            parseAnalysisResponse(raw) → BaAnalysisResult
  │              coerceToString() flattens nested LLM object responses
  │            isComplete(result) → all 5 fields non-null?
  │
  │    complete:
  │      ctx.baOutcome ← outcome
  │      return { status: 'continue' }
  │
  │    incomplete:
  │      deps.addIssueComment(issueKey, questions)
  │      deps.transitionIssueToStatusName(issueKey, "Blocked")
  │      deps.closeGithubIssue(owner, repo, githubIssueNumber)
  │      return { status: 'stop', reason: "BA incomplete" }
  │
  └── types: BaAnalysisResult, BaOutcome, TicketContext, JiraComment
        --> src/workflows/business-analyst/ba-types.ts
```

---

## Full End-to-End Flow

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  1. SCRUM MASTER                                                                      │
│                                                                                       │
│  - Loaded rules from scrum-master.config                                              │
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
│  Step: print_jira_context_to_stdout                                                   │
│  - Ran spec-kit CLI → spec-output/{KEY}/context.md + manifest.json                   │
│  - Logged Jira ticket fields and related tickets to stdout                            │
│                                                                                       │
│  Step: create_github_issue                                                            │
│  - Created GitHub issue placeholder "{KEY}: Copilot Coding Agent Task"               │
│    (label: jira:{KEY}, body: "⏳ BA analysis in progress...")                         │
│                                                                                       │
│  Step: run_ba_inline                                                                  │
│  - Read Jira ticket: summary, description, comments, related tickets                  │
│  - Called GPT-4o inline to analyze ticket requirements                                │
│  - Path: BA complete   → stored baOutcome in pipeline context → continue              │
│  - Path: BA incomplete → added clarification questions as Jira comment                │
│                          updated Jira status: In Progress → Blocked                   │
│                          closed GitHub issue as not planned → stop                    │
│                                                                                       │
│  Step: assign_copilot  (only reached if BA complete)                                  │
│  - Filled github-issue-with-copilot.md template with BA results + spec-kit context   │
│  - PATCHed GitHub issue: full prompt body + assigned copilot-swe-agent[bot]          │
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
