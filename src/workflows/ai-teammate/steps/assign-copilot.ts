/**
 * assign_copilot runner.
 *
 * Builds the Copilot prompt by filling the github-issue-with-copilot.md template
 * with the BA analysis results and Jira context, then updates the GitHub issue body
 * and assigns the Copilot coding agent.
 */
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { AiTeammateDeps, RunnerContext, StepOutcome } from '../runner-types.js';

const TEMPLATE_PATH = '.sdlc-agents/src/workflows/ai-teammate/templates/github-issue-with-copilot.md';
const DEFAULTS_PATH = 'config/spec-kit/defaults.json';
const TBD = '{TBD}';

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export async function runAssignCopilot(
  ctx: RunnerContext,
  deps: AiTeammateDeps,
): Promise<StepOutcome> {
  const { issueKey, owner, repo } = ctx;

  if (!ctx.githubIssueNumber) {
    throw new Error('assign_copilot: no GitHub issue number in context — create_github_issue must run first');
  }
  if (!ctx.baOutcome || ctx.baOutcome.status !== 'complete') {
    throw new Error('assign_copilot: no complete BA outcome in context — run_ba_inline must run first');
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

  // ── Read Jira context from context.md ───────────────────────────
  let jiraContext = '';
  if (ctx.specKitContextFile) {
    try {
      jiraContext = await readFile(ctx.specKitContextFile, 'utf8');
    } catch (e) {
      console.warn('   ⚠️ Could not read context.md (non-fatal):', e);
    }
  }

  // ── Read template ────────────────────────────────────────────────
  const templatePath = resolve(process.cwd(), TEMPLATE_PATH);
  const template = await readFile(templatePath, 'utf8');

  // ── Fill template ────────────────────────────────────────────────
  const prompt = fillTemplate(template, {
    ISSUE_KEY: issueKey,
    DIRECTIVE_PART: directivePart,
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
    agentInstructions: `When opening the PR, add the label 'jira:${issueKey}' to it. Include '${issueKey}' in the PR title prefix (e.g., '${issueKey}: <description>').`,
  });

  console.log(`   ✅ Issue updated and assigned to Copilot Coding Agent`);
  return { status: 'continue' };
}
