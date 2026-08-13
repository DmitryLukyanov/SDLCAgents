# QA Agent

GitHub Action that runs on each pull request:

analyze PR → generate testcases (Claude Code CLI) → optionally run P0 → post a PR comment

## Modes

- `plan-only` — generate and comment. Job stays green if generation/validation succeeds.
- `plan-and-run` — same, then run P0 UI (Playwright) and API (HTTP checks). Job fails if any P0 fails.

Set `QA_MODE` in the workflow. For `plan-and-run`, also set `vars.STAGING_URL` (`base-url`).

## Wire it into another repo (~5 minutes)

1. Add secret `ANTHROPIC_API_KEY`.
2. For `plan-and-run`, add variable `STAGING_URL`.
3. Copy [`examples/qa-agent.yml`](examples/qa-agent.yml) to `.github/workflows/qa-agent.yml`.
4. Replace `OWNER/SDLCAgents` with this repository (`owner/name`).
5. Open a PR. You should get a QA Agent comment.

To execute P0 cases, set `QA_MODE: plan-and-run` in that workflow.

## Local

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

## Layout

- `actions/qa-agent` — prepare, validate, run, publish
- `actions/claude-cli` — readonly Claude Code CLI (inner job step)
- `schemas/testcase.schema.json` — testcase contract
- `prompts/` — generation and repair templates

Claude input and output are uploaded as job artifacts. In `plan-and-run`, screenshots and logs are uploaded too.
