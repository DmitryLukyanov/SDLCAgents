# EPM agents — sequential flow

Raw text diagram of workflows and TypeScript hooks (legacy `sequential-flow.txt`).

```text
================================================================================
EPM AGENTS — SEQUENTIAL FLOW (raw text + code hooks)
================================================================================

Legend:
  [GH]      GitHub Actions workflow YAML
  [TS:path] TypeScript module (functions listed as module.fn())
  Octokit   @octokit/rest client
  -->       next step (sequential)
  ..>       optional / parallel / triggered

--------------------------------------------------------------------------------
SCRUM MASTER — pipeline in scrum-master.config only (JQL per `sm_dispatch_rule` step)
--------------------------------------------------------------------------------

  Human triggers [GH] .github/workflows/scrum-master.yml
    |
    v
  [GH] _reusable-scrum-master.yml → tsx .../scrum-master.ts
    env PIPELINE_CONFIG_FILE or RULES_FILE → path to JSON (default: config/workflows/scrum-master/scrum-master.config)
    |
    v
  [TS:src/workflows/scrum-master/scrum-master-core.ts] runScrumMaster()
          |
          v
          loadSmConfig(ctx.pipelineConfigPath)   [TS:src/workflows/scrum-master/load-sm-config.ts]
          runPipelineStepSequence()                [TS:src/lib/pipeline-expected-step-helper.ts]  (skip disabled / missing jql|configFile|workflowFile; break on stopIfDispatched)
          interpolateJql()              (per step: {jiraProject} from env JIRA_PROJECT)
          |
          v
  FOR each step in loadSmConfig().steps:
          runSmDispatchStep(step, i)
            jqlRequireStatus(interpolateJql(step.jql))
              --> [TS:src/lib/jira-status.ts] getRequiredIssueStatus()
                  wraps: ( <jql> ) AND status = "<taken>"
            searchIssues(effectiveJql, limit, fields)
              --> [TS:src/lib/jira/jira-client.ts] jiraFetch( POST /rest/api/3/search )
            |
  FOR each issue key:
            buildCallerConfig(key)
              --> [TS:src/workflows/scrum-master/build-caller-config.ts]
                  customParams: taken_status, status_to_move_to,
                  ticket_context_depth (default '1' via env TICKET_CONTEXT_DEPTH)
            |
            Octokit.rest.actions.createWorkflowDispatch({
              workflow_id: step.workflowFile,  ← e.g. "ai-teammate.yml" from step
              ref: "master"  (fixed; SCRUM_MASTER_ENTRY_DISPATCH_REF in routing_helper.ts),
              inputs: { concurrency_key, config_file, caller_config }
            })
            |
            transitionIssueToPostRead(key)    [jira-client.ts]
            addIssueLabel(key, step.addLabel) [jira-client.ts]

--------------------------------------------------------------------------------
AI TEAMMATE — one run per dispatched issue
--------------------------------------------------------------------------------

  [GH] .github/workflows/ai-teammate.yml  (calls _reusable-ai-teammate.yml)
    concurrency: ai-teammate-{concurrency_key}
    |
    ── Steps 1-2: checkout consumer repo + SDLCAgents into .sdlc-agents/
    ── Steps 3+: node setup + npm ci (no spec-kit prerequisite gate — optional lightweight pipelines)
    |
    v
  Step: tsx .../ai-teammate-agent.ts (workflow) or npm run ai-teammate-agent (SDLCAgents root)
    --> [TS:src/workflows/ai-teammate/ai-teammate-agent.ts] → runAiTeammateAgent() [ai-teammate-core.ts]
          decodeCallerConfig(CALLER_CONFIG)     [src/lib/caller-config.ts]
          extractIssueKeyFromCallerConfig(root) [src/lib/caller-config.ts]
          runPipeline(issueKey, steps, deps)     [ai-teammate-pipeline.ts]
            (steps from config/workflows/ai-teammate/ai-teammate.config)
    |
    v
  Step: create_github_issue
    --> [TS:src/workflows/ai-teammate/steps/create-github-issue.ts] runCreateGithubIssue()
          deps.createGithubIssue(owner, repo, issueKey)
            ensure label "jira:{KEY}" exists (create if absent)
            octokit.rest.issues.create → empty body
          ctx.githubIssueNumber ← new issue number
          buildMinimalJiraGithubCommentMarkdown() [jira-github-comment.ts]
            getIssue(issueKey, …) [jira-client.ts] + statusAllowsRead [jira-status.ts]
            fetchRelatedIssueSummaries(...) [jira-related.ts] if TICKET_CONTEXT_DEPTH >= 1
          deps.updateGithubIssueBody → marker `<!-- sdlc-agents:jira-context -->` + Jira-only markdown
    |
    v
  Step: Codex BA (params.skipIfLabel / addLabel)
    --> [TS:src/workflows/ai-teammate/steps/run-ba-inline.ts] runBaInline()
          deps.getIssue(issueKey, fields)             [jira-client.ts]
          adfToPlain(description / comments)          [adf-to-plain.ts]
          extractComments(issue)                      [business-analyst-core.ts]
          deps.fetchRelatedIssueSummaries(key, depth) [jira-related.ts]
          mapRelated(related)                         [business-analyst-core.ts]
          deps.analyzeTicket(ctx, githubToken, model) [analyze-ticket.ts]
            buildPrompt(ctx)
              user replies after BA questions → "User Answers to BA Questions"
            callGitHubModels(prompt, token)
              POST models.github.ai/inference/chat/completions
              model=openai/gpt-4o, temp=0.1, response_format=json_object
            parseAnalysisResponse(raw) → BaAnalysisResult
              coerceToString() handles nested LLM object responses
            isComplete() → all 5 fields populated?
          If complete:
            ctx.baOutcome ← outcome
            return { status: 'continue' }
          If incomplete:
            deps.addIssueComment(issueKey, questions)         [jira-client.ts]
            deps.transitionIssueToStatusName(key, "Blocked")  [jira-client.ts]
            deps.closeGithubIssue(owner, repo, githubIssueNumber)
            return { status: 'stop', reason: "BA incomplete" }
    |
    v
  (Removed) Step: assign_copilot
    This step is no longer used by the pipeline.

--------------------------------------------------------------------------------
CONFIG / SECRETS (reference)
--------------------------------------------------------------------------------

  SM pipeline (JSON): env PIPELINE_CONFIG_FILE or RULES_FILE or default config/workflows/scrum-master/scrum-master.config
                      (SmDispatchStep[] per sm_dispatch_rule step: jql, configFile, workflowFile, …)
  Agent JSON:         config/workflows/ai-teammate/ai-teammate.config
  BA (inline):        src/workflows/business-analyst/analyze-ticket.ts → GitHub Models (no separate BA workflow)
  Coding agent def:   .github/agents/sdlc.pipeline.agent.md  (SDLCClient)
  GitHub secrets:     JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
                      COPILOT_PAT (GitHub Models API + issues write)

================================================================================
END
================================================================================
```
