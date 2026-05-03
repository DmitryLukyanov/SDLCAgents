/**
 * start_developer_agent runner.
 *
 * Updates the GitHub issue body with Jira context and BA analysis results,
 * then dispatches the developer agent workflow to start the spec-kit pipeline
 * (beginning with the "specify" step). Branch, draft PR, and initial
 * `speckit-state.json` are created by the consumer workflow's bootstrap job
 * (`_reusable-developer-agent-bootstrap.yml`); this step only passes issue_key
 * and issue_number (no branch_name — bootstrap chooses or reuses a branch).
 */
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';
import { fillTemplate } from '../../../lib/template-utils.js';

const TEMPLATE_PATH = '.sdlc-agents/src/workflows/ai-teammate/templates/github-issue.md';
const DEFAULTS_PATH = 'config/spec-kit/defaults.json';
const TBD = '{TBD}';

/**
 * JSON-escapes a string for safe embedding inside a JSON string literal.
 * JSON.stringify produces `"value"` — we strip the surrounding quotes to get
 * just the escaped content, which can then be placed inside a template's `"..."`.
 */
function toJsonSafe(val: string): string {
  return JSON.stringify(val).slice(1, -1);
}

/** TEMP: reusable workflow sets `AI_TEAMMATE_SKIP_DEVELOPER_AGENT_DISPATCH=true` to skip developer-agent dispatch only. */
function skipDeveloperAgentDispatch(): boolean {
  return process.env.AI_TEAMMATE_SKIP_DEVELOPER_AGENT_DISPATCH?.trim() === 'true';
}

/** Step config shape as it appears in ai-teammate.config */
interface StartDeveloperAgentStep {
  runner: 'start_developer_agent';
  /** Consumer repo workflow file to dispatch. Defaults to "developer-agent.yml". */
  workflowFile?: string;
}

export async function runStartDeveloperAgent(
  ctx: RunnerContext,
  step: StartDeveloperAgentStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo, ref } = ctx;

  if (!ctx.githubIssueNumber) {
    throw new Error('start_developer_agent: no GitHub issue number in context — create_github_issue must run first');
  }
  if (!ctx.baOutcome || ctx.baOutcome.status !== 'complete') {
    throw new Error(
      'start_developer_agent: no complete BA outcome in context — Codex BA finish must run first',
    );
  }

  const result = ctx.baOutcome.result;

  // ── Read global directive ────────────────────────────────────────
  let directivePart = '';
  try {
    const defaultsRaw = await readFile(resolve(process.cwd(), DEFAULTS_PATH), 'utf8');
    const defaults = JSON.parse(defaultsRaw) as { globalDirective?: string };
    const directive = defaults.globalDirective?.trim();
    if (directive) directivePart = `${directive} — `;
  } catch {
    // non-fatal — directive is optional
  }

  // ── Read Jira context from issueContext.md ──────────────────────
  let jiraContext = '';
  if (ctx.specKitContextFile) {
    try {
      jiraContext = await readFile(ctx.specKitContextFile, 'utf8');
    } catch (e) {
      console.warn('   ⚠️ Could not read issueContext.md (non-fatal):', e);
    }
  }

  // ── Fill issue body template ─────────────────────────────────────
  const templatePath = resolve(process.cwd(), TEMPLATE_PATH);
  const template = await readFile(templatePath, 'utf8');

  // JSON-escape values that will be embedded inside a JSON string literal in the template.
  // BA analysis results may contain newlines, quotes, and other control characters that
  // would produce invalid JSON if interpolated as-is.
  const issueBody = fillTemplate(template, {
    ISSUE_KEY: issueKey,
    DIRECTIVE_PART: toJsonSafe(directivePart),
    JIRA_CONTEXT: jiraContext,
    SPECIFY_INPUT: toJsonSafe(result.specifyInput || TBD),
    CLARIFY_INPUT: toJsonSafe(result.clarifyInput || TBD),
    PLAN_INPUT: toJsonSafe(result.planInput || TBD),
    TASKS_INPUT: toJsonSafe(result.tasksInput || TBD),
    IMPLEMENT_INPUT: toJsonSafe(result.implementInput || TBD),
  });

  // ── Update GitHub issue body ─────────────────────────────────────
  console.log(`\n── Updating GitHub issue #${ctx.githubIssueNumber} ──`);
  await deps.updateGithubIssueBody(owner, repo, ctx.githubIssueNumber, issueBody);
  console.log(`   ✅ Issue body updated`);

  if (skipDeveloperAgentDispatch()) {
    console.log(
      '\n── Skipping developer agent workflow_dispatch (AI_TEAMMATE_SKIP_DEVELOPER_AGENT_DISPATCH) ──',
    );
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      await appendFile(
        summaryPath,
        '\n## Developer agent dispatch\n\nSkipped (`AI_TEAMMATE_SKIP_DEVELOPER_AGENT_DISPATCH` in reusable workflow). Issue body was still updated from BA.\n',
      );
    }
    return { status: 'continue' };
  }

  // ── Dispatch developer agent workflow ────────────────────────────
  const workflowFile = step.workflowFile ?? 'developer-agent.yml';
  console.log(`\n── Dispatching developer agent (${workflowFile}, step=specify) ──`);

  await deps.dispatchDeveloperAgent(owner, repo, workflowFile, ref, {
    issue_number: String(ctx.githubIssueNumber),
    issue_key: issueKey,
    step: 'specify',
  });

  console.log(`   ✅ Developer agent dispatched — spec-kit pipeline starting with "specify"`);
  return { status: 'continue' };
}
