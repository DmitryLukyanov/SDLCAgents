# QA Agent

GitHub Action that runs on each pull request:

analyze PR → generate testcases (Claude Code CLI) → run all cases → post a PR comment

UI cases run with Playwright. API cases run as HTTP checks. The job fails if any case fails.

## Setup

1. Add secret `ANTHROPIC_API_KEY`.
2. Add variable `STAGING_URL` (base URL used to run the cases).
3. Open a PR. You should get a QA Agent comment with pass/fail results.

## Local

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

## Layout

- `src/qa-agent` — prepare, validate, run, publish (GitHub Action in this folder)
- `src/claude-cli` — Claude CLI Action and its prompts
- `tests/` — unit tests, same folder layout as `src/`
- `schemas/testcase.schema.json` — testcase contract

Claude input/output, screenshots, and logs are uploaded as job artifacts.

## @claude comments (GitHub App identity)

On a PR, comment:

```text
@claude add a case: sin(270) should be -1
```

GitHub Actions hears the comment. The job posts the QA result with the App token, so the comment author is **SDLC QA Agent**, not `github-actions[bot]`. The same identity is used on the pull_request run.

1. Install the GitHub App on this repo.
2. Add secrets `QA_APP_ID` and `QA_APP_PRIVATE_KEY` (PEM).
3. Merge the workflow to the default branch (`issue_comment` workflows run from default).

`@claude` comments from bots are ignored. The last `githubaction-workspace-pr-<number>` artifact is the previous case list.

## Calculator (GitHub Pages)

Site: https://dmitrylukyanov.github.io/SDLCAgents/
