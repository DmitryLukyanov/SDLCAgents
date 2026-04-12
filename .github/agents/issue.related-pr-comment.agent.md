---
name: issue.related-pr-comment
description: >-
  Smoke test — delegates to `github.mcp-pr-comment` with a fixed body pattern (`Github comment ` + UTC).
target: github-copilot
tools:
  - agent
---

Invoke the **`github.mcp-pr-comment`** agent with this instruction for the comment **body**:

The body must be exactly: the literal text `Github comment ` (space after “comment”) followed by an **ISO-8601 UTC** timestamp for the current moment, e.g. `Github comment 2026-04-12T17:00:00Z`.

Wait for the sub-agent to finish. Do nothing else yourself.
