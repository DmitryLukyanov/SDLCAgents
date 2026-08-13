# QA Agent

GitHub Action that runs on each pull request:

analyze PR → generate testcases (Claude Code CLI) → run P0 → post a PR comment

P0 UI cases run with Playwright. P0 API cases run as HTTP checks. The job fails if any P0 fails.

## Wire it into another repo (~5 minutes)

1. Add secret `ANTHROPIC_API_KEY`.
2. Add variable `STAGING_URL` (base URL used to run the cases).
3. Copy [`examples/qa-agent.yml`](examples/qa-agent.yml) to `.github/workflows/qa-agent.yml`.
4. Replace `OWNER/SDLCAgents` with this repository (`owner/name`).
5. Open a PR. You should get a QA Agent comment with pass/fail results.

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

Claude input/output, screenshots, and logs are uploaded as job artifacts.
