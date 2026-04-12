---
name: github.mcp-pr-comment
description: >-
  Post exactly one pull request timeline comment via GitHub MCP. Comment body comes from
  prompt `$ARGUMENTS`, issue “Additional instructions”, parent-agent delegation, or the fallbacks below.
target: github-copilot
tools:
  - github/list_pull_requests
  - github/add_issue_comment
---

## User input (`$ARGUMENTS`)

When this agent is run from **`.github/prompts/github.mcp-pr-comment.prompt.md`** (or similar), the user’s text after the command is passed as **`$ARGUMENTS`**.

```text
$ARGUMENTS
```

If **`$ARGUMENTS`** is non-empty after trimming, use it **as the full PR comment `body`** and skip the fallback list below (unless the caller clearly mixed meta-instructions with the body — then prefer the longest contiguous block that reads like a comment).

---

## Comment `body` (fallbacks — only if `$ARGUMENTS` is empty)

Take the **entire** comment markdown/plain text from **one** of these, in order:

1. **Additional instructions** from the “Assign agent to issue” flow (if present).
2. Instructions passed when **another agent invoked `github.mcp-pr-comment`** (delegation).
3. Otherwise the **user’s first message** in this session (if it is clearly the comment body, not meta-instructions).
4. Otherwise a line in the issue or assignment that starts with **`Comment body:`** or **`body:`** — use everything after that prefix on that line, or the following indented block.

If none of these yield a **non-empty** string, reply once asking for the comment body and stop (do not post an empty comment).

---

## MCP steps

Do not use **`gh`**, shell, commits, or file edits.

1. **`owner`** and **`repo`** — Repository this Copilot session is working in.

2. **`pullNumber`** — Use the PR number from the task/session when given. Otherwise call **`github/list_pull_requests`** with `owner`, `repo`, `state` = `open`, and `head` = `{owner}:{current-branch-name}` (filter shape `ORG_OR_USER:branch-name`). Use the returned PR **`number`**.

3. **`github/add_issue_comment`** — Pass `owner`, `repo`, **`issue_number`** = that PR number (PRs use the issues API), **`body`** = the string from the section above.

4. Stop. On **403** or “read only”, state that the repo must enable [writable GitHub MCP + PAT](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/extend-cloud-agent-with-mcp#customizing-the-built-in-github-mcp-server) (e.g. **`COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN`** on environment **`copilot`**, non-readonly MCP URL, toolsets that include **`add_issue_comment`**).

---

## Tool IDs

If **`github/list_pull_requests`** / **`github/add_issue_comment`** are missing, try **`github/github-mcp-server/list_pull_requests`** and **`github/github-mcp-server/add_issue_comment`**, or **`github/*`** if admins allow it.

---

## For other agents (reuse)

Include **`agent`** in the parent’s `tools`, then delegate, for example:

> Invoke the **`github.mcp-pr-comment`** agent with this instruction for the comment **body**: \<your full markdown or plain text here\>.
