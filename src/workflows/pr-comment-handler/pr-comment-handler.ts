/**
 * PR Comment Handler — routing entry point.
 *
 * Reads a PR comment body and dispatches the appropriate consumer workflow
 * based on the slash command:
 *
 *   /proceed   → developer-agent-proceed.yml
 *   /fix <…>   → developer-agent-fix.yml
 *
 * Environment variables (set by _reusable-pr-comment-handler.yml):
 *   GITHUB_TOKEN or COPILOT_PAT  — GitHub API token
 *   GITHUB_REPOSITORY            — "owner/repo"
 *   COMMENT_BODY                 — full PR comment text
 *   PR_NUMBER                    — PR / issue number (string)
 *   DEFAULT_BRANCH               — repo default branch for workflow dispatch ref
 *   GITHUB_STEP_SUMMARY          — set by Actions; full comment + outcome appended here
 */

import { appendFileSync } from 'node:fs';
import { Octokit } from '@octokit/rest';

const MAX_COMMENT_IN_SUMMARY = 120_000;

function appendStepSummary(md: string): void {
  const f = process.env['GITHUB_STEP_SUMMARY'];
  if (f) appendFileSync(f, `${md}\n`);
}

/** Avoid breaking markdown fences in the job summary. */
function fenceSafe(s: string): string {
  return s.replace(/```/g, '\\`\\`\\`');
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const token      = process.env['COPILOT_PAT'] ?? requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const prNumber   = requireEnv('PR_NUMBER');
  const body       = (process.env['COMMENT_BODY'] ?? '').trimStart();
  const ref        = process.env['DEFAULT_BRANCH'] || 'master';

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}"`);

  const octokit = new Octokit({ auth: token });

  // Scan every line for the first slash command, ignoring quoted lines (> ...).
  // This allows users to quote the HIL comment and append /fix or /proceed below it.
  const lines = body.split('\n');
  const commandLineIdx = lines.findIndex(
    line => /^\s*\/\w/.test(line) && !line.trimStart().startsWith('>'),
  );
  const commandLine    = commandLineIdx >= 0 ? lines[commandLineIdx].trimStart() : '';
  const command        = commandLine.split(/\s+/)[0] ?? '';

  // For /fix: pass only from the command line onwards so the reusable workflow's
  // sed prefix-strip (`s|^/fix[[:space:]]*||`) receives a body that starts with /fix.
  const commandBody = commandLineIdx >= 0
    ? lines.slice(commandLineIdx).join('\n').trimStart()
    : body;

  console.log(`[pr-comment-handler] PR #${prNumber} — command: "${command}" (line ${commandLineIdx})`);

  let outcome = '';

  switch (command) {
    case '/proceed':
      await octokit.rest.actions.createWorkflowDispatch({
        owner, repo,
        workflow_id: 'developer-agent-proceed.yml',
        ref,
        inputs: { pr_number: prNumber },
      });
      console.log(`[pr-comment-handler] Dispatched developer-agent-proceed.yml`);
      outcome = `Dispatched **developer-agent-proceed.yml** with \`pr_number=${prNumber}\`.`;
      break;

    case '/fix': {
      // Fetch the last HIL comment posted by the spec gate so the LLM knows
      // exactly which issues to address — not just the user's brief instruction.
      let hilContext = '';
      try {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner, repo,
          issue_number: parseInt(prNumber, 10),
          per_page: 100,
        });
        const hilComment = [...comments]
          .reverse()
          .find(c => c.body?.includes('<!-- speckit-gate: hil'));
        if (hilComment?.body) {
          // Strip the HTML marker line — keep the human-readable content only
          const hilBody = hilComment.body
            .replace(/^<!--.*?-->\s*/s, '')
            .trim();
          hilContext = `\n\n---\n\n## Spec Gate Issues to Address\n\n${hilBody}`;
          console.log(`[pr-comment-handler] Found HIL comment #${hilComment.id} — appending as context`);
        }
      } catch (err) {
        console.warn('[pr-comment-handler] Could not fetch HIL comment (non-fatal):', err);
      }

      await octokit.rest.actions.createWorkflowDispatch({
        owner, repo,
        workflow_id: 'developer-agent-fix.yml',
        ref,
        inputs: {
          pr_number:        prNumber,
          fix_comment_body: commandBody + hilContext,
        },
      });
      console.log(`[pr-comment-handler] Dispatched developer-agent-fix.yml`);
      outcome = 'Dispatched **developer-agent-fix.yml** (includes HIL context when found).';
      break;
    }

    default:
      console.log(`[pr-comment-handler] No matching command — ignoring`);
      outcome = `_No routing_: first actionable line did not start with \`/proceed\` or \`/fix\`.`;
  }

  const bodyShown =
    body.length > MAX_COMMENT_IN_SUMMARY
      ? `${fenceSafe(body.slice(0, MAX_COMMENT_IN_SUMMARY))}\n\n_…(truncated for job summary size)_`
      : fenceSafe(body);

  appendStepSummary('## PR Comment Handler');
  appendStepSummary('');
  appendStepSummary(`| Field | Value |`);
  appendStepSummary(`|-------|-------|`);
  appendStepSummary(`| **PR** | #${prNumber} |`);
  appendStepSummary(`| **Repository** | \`${repository}\` |`);
  appendStepSummary(`| **Default branch (dispatch ref)** | \`${ref}\` |`);
  appendStepSummary(`| **Detected command** | \`${command || '(none)'}\` (line index ${commandLineIdx}) |`);
  appendStepSummary(`| **Outcome** | ${outcome.replace(/\|/g, '\\|')} |`);
  appendStepSummary('');
  appendStepSummary('### Full trigger comment');
  appendStepSummary('');
  appendStepSummary('```text');
  appendStepSummary(bodyShown || '_(empty)_');
  appendStepSummary('```');
}

main().catch((err) => {
  console.error('[pr-comment-handler] Fatal error:', err);
  process.exit(1);
});
