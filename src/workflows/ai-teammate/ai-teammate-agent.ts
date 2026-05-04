/**
 * AI Teammate entry point: wires real deps and runs the agent.
 *
 * Environment (from _reusable-ai-teammate.yml):
 *   CONFIG_FILE   — workflow input `config_file` → agent JSON path in consumer repo
 *   CALLER_CONFIG — workflow input `caller_config` → URL-encoded JSON { params: { inputJql, customParams? } }
 *   COPILOT_PAT   — PAT for GitHub REST except issue comments (create issue, dispatch, …)
 *   GITHUB_TOKEN  — ${{ github.token }} at job level (github-actions[bot]) for issue comments (BA progress, etc.)
 *
 * Modes (`AI_TEAMMATE_MODE`, required):
 *   pipeline_ci — CI default: config `params.steps` + optional async handoff; parent resume via `caller_config.params.async_child_run_id` + `async_trigger_step`
 *
 * Optional (CI): `AI_TEAMMATE_SKIP_BA_REASON` — when non-empty (from job output `skip_reason`), BA segment is skipped.
 */
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
import { getIssue, addIssueComment, addIssueLabel, transitionIssueToStatusName } from '../../lib/jira/jira-client.js';
import { fetchRelatedIssueSummaries } from '../../lib/jira/jira-related.js';
import {
  extractJiraSnapshotMarkdownAfterMarker,
  JIRA_CONTEXT_GITHUB_COMMENT_MARKER,
} from './jira-github-comment.js';
import { runPipelineCi } from './ai-teammate-pipeline.js';
import type { AiTeammateDeps } from './runner-types.js';

const ISSUE_TITLE_TEMPLATE  = loadTemplate(import.meta.url, 'templates', 'github-issue-title.md');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Octokit-backed deps for pipeline / Codex BA phases (tests may inject a stub). */
export function buildAiTeammateDeps(): AiTeammateDeps {
  const octokitRest = new Octokit({ auth: requireEnv('COPILOT_PAT') });
  const octokitComment = new Octokit({ auth: requireEnv('GITHUB_TOKEN') });

  return {
    getIssue,
    addIssueComment,
    addJiraIssueLabel: addIssueLabel,
    transitionIssueToStatusName,
    fetchRelatedIssueSummaries,
    fetchJiraContextFromGithubIssue: async (owner, repo, issueNumber) => {
      const { data: issue } = await octokitRest.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });
      const fromBody = extractJiraSnapshotMarkdownAfterMarker(issue.body ?? '');
      if (fromBody) return fromBody;

      const comments = await octokitRest.paginate(octokitRest.rest.issues.listComments, {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });
      let latest = '';
      for (const c of comments) {
        const body = typeof c.body === 'string' ? c.body : '';
        if (body.includes(JIRA_CONTEXT_GITHUB_COMMENT_MARKER)) {
          latest = extractJiraSnapshotMarkdownAfterMarker(body);
        }
      }
      return latest;
    },
    createGithubIssue: async (owner, repo, issueKey) => {
      await octokitRest.rest.issues.createLabel({
        owner, repo,
        name: `jira:${issueKey}`,
        color: '1d76db',
        description: `Jira ticket ${issueKey}`,
      }).catch(() => { /* label may already exist */ });

      const response = await octokitRest.rest.issues.create({
        owner,
        repo,
        title: fillTemplate(ISSUE_TITLE_TEMPLATE, { ISSUE_KEY: issueKey }),
        body: '',
        labels: [`jira:${issueKey}`],
      });
      return response.data.number;
    },
    updateGithubIssueBody: async (owner, repo, issueNumber, body) => {
      await octokitRest.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
    },
    updateGithubIssue: async (owner, repo, issueNumber, payload) => {
      await octokitRest.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
        body: payload.body,
        assignees: payload.assignees,
        agent_instructions: payload.agentInstructions,
      });
    },
    dispatchDeveloperAgent: async (owner, repo, workflowFile, ref, inputs) => {
      await octokitRest.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowFile,
        ref,
        inputs,
      });
    },
    closeGithubIssue: async (owner, repo, issueNumber) => {
      await octokitRest.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed',
        state_reason: 'not_planned',
      });
    },
    addGithubIssueComment: async (owner, repo, issueNumber, body) => {
      await octokitComment.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
    },
  };
}

async function main(): Promise<void> {
  const mode = process.env.AI_TEAMMATE_MODE?.trim() ?? '';
  const deps = buildAiTeammateDeps();
  if (mode === 'pipeline_ci') {
    await runPipelineCi(deps);
    return;
  }

  // Legacy split-step modes were removed in favor of the config-driven pipeline.
  // For local debugging, use `AI_TEAMMATE_MODE=pipeline_ci` with an appropriate `CALLER_CONFIG`.
  // (The reusable workflow already sets `AI_TEAMMATE_MODE=pipeline_ci`.)
  throw new Error(
    `AI_TEAMMATE_MODE must be "pipeline_ci" (got "${mode || '(empty)'}").`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
