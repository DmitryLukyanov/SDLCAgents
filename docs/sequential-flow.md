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
    --> [TS:src/workflows/ai-teammate/ai-teammate-agent.ts] → runPipelineCi(deps) [ai-teammate-pipeline.ts]
          loadAiTeammatePipelineFromEnv()      [ai-teammate-core.ts]
          decodeCallerConfig / extractIssueKey  [src/lib/caller-config.ts]
          evaluateSkipIfLabelFromConfigFile (fresh runs) [lib/agent-skip-if-label.ts]
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
  Step: async_operation (async_call → consumer business-analyst / Codex)
    --> [TS:src/workflows/ai-teammate/ai-teammate-codex-ba-prepare.ts] prepareCodexBaArtifacts()
          writes async-invocation-handoff/<KEY>/* ; reusable workflow dispatches child
    |
    v
  Step: apply_ba_outcome (pipeline resume after child)
    --> [TS:src/workflows/ai-teammate/steps/apply-ba-outcome.ts] runApplyBaOutcome()
          interpretBaModelOutput() [business-analyst/analyze-ticket.ts]
          applyCodexBaOutcomeToJiraAndGithub() [apply-codex-ba-outcome-to-jira-github.ts]
    |
    v
  Optional: async_terminal_operation (e.g. speckit-developer-agent.yml)
    --> [TS:src/workflows/ai-teammate/dispatch-pipeline-async-child-ci.ts] (terminal dispatch)

--------------------------------------------------------------------------------
CONFIG / SECRETS (reference)
--------------------------------------------------------------------------------

  SM pipeline (JSON): env PIPELINE_CONFIG_FILE or RULES_FILE or default config/workflows/scrum-master/scrum-master.config
                      (SmDispatchStep[] per sm_dispatch_rule step: jql, configFile, workflowFile, …)
  Agent JSON:         config/workflows/ai-teammate/ai-teammate.config
  BA (Codex):         consumer business-analyst.yml / Codex; interpret output in apply-ba-outcome.ts (analyze-ticket.ts)
  Coding agent def:   .github/agents/sdlc.pipeline.agent.md  (SDLCClient)
  GitHub secrets:     JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
                      COPILOT_PAT (GitHub Models API + issues write)

================================================================================
END
================================================================================
```
