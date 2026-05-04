/**
 * assign_copilot runner.
 *
 * Builds the Copilot prompt by filling the github-issue-with-copilot.md template
 * with the BA analysis results and Jira context, then updates the GitHub issue body
 * and assigns the Copilot coding agent.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';
import { fillTemplate, loadTemplate } from '../../../lib/template-utils.js';

const TEMPLATE_PATH = '.sdlc-agents/src/workflows/ai-teammate/templates/github-issue-with-copilot.md';
const AGENT_INSTRUCTIONS_TEMPLATE = loadTemplate(import.meta.url, '..', 'prompts', 'copilot-agent-instructions.md');
const TBD = '{TBD}';

export async function runAssignCopilot(
  ctx: RunnerContext,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo } = ctx;

  if (!ctx.githubIssueNumber) {
    throw new Error('assign_copilot: no GitHub issue number in context — create_github_issue must run first');
  }
  if (!ctx.baOutcome || ctx.baOutcome.status !== 'complete') {
    throw new Error('assign_copilot: no complete BA outcome in context — BA must complete first');
  }

  const result = ctx.baOutcome.result;

  let jiraContext = '';
  try {
    jiraContext = await deps.fetchJiraContextFromGithubIssue(owner, repo, ctx.githubIssueNumber);
  } catch (e) {
    console.warn('   ⚠️ Could not read Jira snapshot from GitHub issue (non-fatal):', e);
  }

  // ── Read template ────────────────────────────────────────────────
  const templatePath = resolve(process.cwd(), TEMPLATE_PATH);
  const template = await readFile(templatePath, 'utf8');

  // ── Fill template ────────────────────────────────────────────────
  const prompt = fillTemplate(template, {
    ISSUE_KEY: issueKey,
    DIRECTIVE_PART: '',
    JIRA_CONTEXT: jiraContext,
    SPECIFY_INPUT: result.specifyInput || TBD,
    CLARIFY_INPUT: result.clarifyInput || TBD,
    PLAN_INPUT: result.planInput || TBD,
    TASKS_INPUT: result.tasksInput || TBD,
    IMPLEMENT_INPUT: result.implementInput || TBD,
  });

  // ── Update GitHub issue + assign Copilot ─────────────────────────
  console.log(`\n── Updating GitHub issue #${ctx.githubIssueNumber} and assigning Copilot ──`);

  await deps.updateGithubIssue(owner, repo, ctx.githubIssueNumber, {
    body: prompt,
    assignees: ['copilot-swe-agent[bot]'],
    agentInstructions: fillTemplate(AGENT_INSTRUCTIONS_TEMPLATE, { ISSUE_KEY: issueKey }),
  });

  console.log(`   ✅ Issue updated and assigned to Copilot Coding Agent`);
  return { status: 'continue' };
}
