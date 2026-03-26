---
description: Create a GitHub Issue and assign Copilot Coding Agent to it.

on:
  workflow_dispatch:
    inputs:
      issue_title:
        description: Title for the GitHub Issue
        required: true
        type: string
      issue_body:
        description: The full issue body content (Markdown)
        required: true
        type: string
      issue_key:
        description: Jira issue key for logging purposes
        required: false
        type: string

permissions:
  contents: read
  issues: read

engine:
  id: copilot
  model: gpt-4.1

timeout-minutes: 5

network: defaults

safe-outputs:
  create-issue:
    assignees: copilot
    max: 1
    close-older-issues: true
    footer: false

tools:
  github:
    toolsets: [default]

secrets:
  GH_AW_AGENT_TOKEN: ${{ secrets.COPILOT_PAT }}
---

# Create Issue and Assign Copilot Coding Agent

You are a simple dispatcher. Your job is to create a single GitHub Issue.

## What to do

1. The issue title is provided via the `issue_title` workflow input.
2. The issue body is provided via the `issue_body` workflow input. Use it **verbatim** — do not summarize, rephrase, or alter it in any way.
3. Create the issue using the `create-issue` safe output. Do not add any extra content.

## Important

- Do **not** modify the issue body content. Copy it exactly as-is.
- Do **not** add commentary, analysis, or suggestions.
- The `assignees: copilot` configuration handles Copilot assignment automatically.
