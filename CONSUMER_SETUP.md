# Connecting a Repo to the SDLC Pipeline

This guide sets up a new repository to use the full SDLC automation pipeline
(Jira → GitHub Issue → Copilot Coding Agent → spec-kit → PR → merge → Jira Done)
powered by [DmitryLukyanov/SDLCAgents](https://github.com/DmitryLukyanov/SDLCAgents).

---

## Prerequisites

- GitHub Copilot Coding Agent enabled on your organization
  (Settings → Copilot → Coding agent)
- A Jira project with API access
- A GitHub Classic PAT with `repo`, `workflow`, and `read:org` scopes

---

## Step 1 — Copy workflow files

Copy all four workflow templates into your repo:

```
consumer-templates/.github/workflows/  →  .github/workflows/
```

| File | Purpose |
|------|---------|
| `scrum-master.yml` | Scans Jira for To-Do tickets and dispatches AI Teammate |
| `ai-teammate.yml` | Prepares spec-kit context, creates GitHub Issue, assigns Copilot |
| `mark-pr-ready.yml` | Fires after Copilot finishes — approves, merges, closes issue, updates Jira |
| `copilot-setup-steps.yml` | Copilot environment setup (customize for your stack) |

---

## Step 2 — Copy config files

Copy the config templates into your repo:

```
consumer-templates/config/  →  config/
```

Then customize:

| File | What to change |
|------|---------------|
| `config/sm.json` | Set your Jira JQL query (replace `{jiraProject}` with your project key, or hardcode it) |
| `config/spec-kit/defaults.json` | Adjust `globalDirective`, `specify`, `plan`, `tasks` prompts for your project |
| `config/spec-kit/constitution.md` | Replace with your project's coding standards and conventions |
| `config/agents/dummy-ticket-agent.json` | No changes needed for standard use |

**Example `config/sm.json` for project key `MYPROJ`:**
```json
{
  "rules": [
    {
      "description": "To Do queue → Copilot Coding Agent",
      "jql": "project = MYPROJ AND status = 'To Do' ORDER BY updated ASC",
      "configFile": "config/agents/dummy-ticket-agent.json",
      "workflowFile": "ai-teammate.yml",
      "workflowRef": "main",
      "limit": 5,
      "skipIfLabel": "sm_triggered",
      "addLabel": "sm_triggered"
    }
  ]
}
```

---

## Step 3 — Initialize spec-kit

Run this once in your repo root and commit the result:

```bash
uvx --from git+https://github.com/github/spec-kit.git@v0.4.0 \
  specify init --here --ai copilot --script ps --force
```

This generates `.specify/`, `.github/agents/speckit.*.agent.md`,
and `.github/prompts/speckit.*.prompt.md`.

Then copy the two custom agents from SDLCAgents into your `.github/agents/`:

```bash
# From SDLCAgents repo, copy to your repo's .github/agents/
cp .github/agents/speckit.orchestrator.agent.md  YOUR_REPO/.github/agents/
cp .github/agents/sdlc.pipeline.agent.md         YOUR_REPO/.github/agents/
cp .github/agents/code.review.agent.md           YOUR_REPO/.github/agents/
```

---

## Step 4 — Configure secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `JIRA_BASE_URL` | `https://yourorg.atlassian.net` |
| `JIRA_EMAIL` | Your Jira login email |
| `JIRA_API_TOKEN` | Jira API token (Atlassian account → Security → API tokens) |
| `COPILOT_PAT` | GitHub Classic PAT with `repo`, `workflow`, `read:org` scopes |

---

## Step 5 — Commit and push

```bash
git add .github/ config/ .specify/
git commit -m "chore: connect SDLC pipeline"
git push
```

---

## Step 6 — Test the pipeline

1. Create a Jira ticket in your project with status **To Do**
2. Go to **Actions → Scrum Master → Run workflow**
3. Leave all inputs as defaults and click **Run workflow**

Expected flow:
```
Scrum Master
  └─► AI Teammate (per ticket)
        └─► Copilot Coding Agent (creates branch + PR)
              └─► Mark PR Ready (approves + merges + closes issue + Jira → Done)
```

---

## Pinning to a specific version

By default, workflows pull from `main` of SDLCAgents. To pin to a specific commit or tag,
edit the `sdlc_agents_ref` input in your caller workflows:

```yaml
jobs:
  call:
    uses: DmitryLukyanov/SDLCAgents/.github/workflows/_reusable-scrum-master.yml@main
    with:
      sdlc_agents_ref: 'v1.2.3'   # or a commit SHA
    secrets: inherit
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Spec-Kit is not initialized` | Run `specify init --here` (Step 3) |
| `Missing agent file` | Copy missing files from `SDLCAgents/.github/agents/` |
| `No open PR found for branch` | Copilot may not have opened a PR yet; check the Copilot agent session |
| Jira transition skipped | PR title must contain the Jira key, e.g. `TC-5: ...` |
| `404` dispatching `ai-teammate.yml` | Ensure `ai-teammate.yml` is committed on the branch set in `workflowRef` in `config/sm.json` |
