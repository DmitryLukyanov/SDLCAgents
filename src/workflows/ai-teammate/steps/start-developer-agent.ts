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
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';
import { fillTemplate } from '../../../lib/template-utils.js';

const TEMPLATE_PATH = '.sdlc-agents/src/workflows/ai-teammate/templates/github-issue.md';
const TBD = '{TBD}';

/**
 * JSON-escapes a string for safe embedding inside a JSON string literal.
 * JSON.stringify produces `"value"` — we strip the surrounding quotes to get
 * just the escaped content, which can then be placed inside a template's `"..."`.
 */
function toJsonSafe(val: string): string {
  return JSON.stringify(val).slice(1, -1);
}

/** Step config shape as it appears in ai-teammate.config */
interface StartDeveloperAgentStep {
  runner: 'start_developer_agent';
  /** Consumer repo workflow file to dispatch. Defaults to "developer-agent.yml". */
  workflowFile?: string;
}

/**
 * Callback-free async equivalent of start_developer_agent.
 *
 * This is an agent-agnostic pattern: "prepare" writes all inputs to an
 * invocation handoff workspace and the pipeline (or caller) performs the actual
 * dispatch to a child job. The child job can later resume and run
 * `start_developer_agent` (sync) or other steps.
 */
export async function prepareStartDeveloperAgentAsync(
  ctx: RunnerContext,
  step: StartDeveloperAgentStep,
  deps: AiTeammateDeps,
): Promise<{
  issueBody: string;
  workflowFile: string;
  dispatchInputs: { issue_number: string; issue_key: string; step: string };
}> {
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

  // ── Read Jira context from GitHub issue body (set in create_github_issue) ──
  let jiraContext = '';
  try {
    jiraContext = await deps.fetchJiraContextFromGithubIssue(owner, repo, ctx.githubIssueNumber);
  } catch (e) {
    console.warn('   ⚠️ Could not read Jira snapshot from GitHub issue (non-fatal):', e);
  }
  if (!jiraContext.trim()) {
    console.warn('   ⚠️ No Jira snapshot in issue body (or legacy comment) — template may omit full Jira markdown');
  }

  // ── Fill issue body template ─────────────────────────────────────
  const templatePath = resolve(process.cwd(), TEMPLATE_PATH);
  const template = await readFile(templatePath, 'utf8');

  const issueBody = fillTemplate(template, {
    ISSUE_KEY: issueKey,
    DIRECTIVE_PART: toJsonSafe(''),
    JIRA_CONTEXT: jiraContext,
    SPECIFY_INPUT: toJsonSafe(result.specifyInput || TBD),
    CLARIFY_INPUT: toJsonSafe(result.clarifyInput || TBD),
    PLAN_INPUT: toJsonSafe(result.planInput || TBD),
    TASKS_INPUT: toJsonSafe(result.tasksInput || TBD),
    IMPLEMENT_INPUT: toJsonSafe(result.implementInput || TBD),
  });

  const workflowFile = step.workflowFile ?? 'developer-agent.yml';

  return {
    issueBody,
    workflowFile,
    dispatchInputs: {
      issue_number: String(ctx.githubIssueNumber),
      issue_key: issueKey,
      step: 'specify',
      // `ref` is carried separately by the caller.
    },
  };
}

export async function runStartDeveloperAgent(
  ctx: RunnerContext,
  step: StartDeveloperAgentStep,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { owner, repo, ref } = ctx;
  const prepared = await prepareStartDeveloperAgentAsync(ctx, step, deps);

  // ── Update GitHub issue body ─────────────────────────────────────
  console.log(`\n── Updating GitHub issue #${ctx.githubIssueNumber} ──`);
  await deps.updateGithubIssueBody(owner, repo, ctx.githubIssueNumber!, prepared.issueBody);
  console.log(`   ✅ Issue body updated`);

  // ── Dispatch developer agent workflow ────────────────────────────
  console.log(`\n── Dispatching developer agent (${prepared.workflowFile}, step=specify) ──`);
  await deps.dispatchDeveloperAgent(owner, repo, prepared.workflowFile, ref, prepared.dispatchInputs);
  console.log(`   ✅ Developer agent dispatched — spec-kit pipeline starting with "specify"`);
  return { status: 'continue' };
}
