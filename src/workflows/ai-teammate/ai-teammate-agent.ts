/**
 * AI Teammate entry point: wires real deps and runs the agent.
 *
 * Environment (from _reusable-ai-teammate.yml):
 *   CONFIG_FILE   — workflow input `config_file` → agent JSON path in consumer repo
 *   CALLER_CONFIG — workflow input `caller_config` → URL-encoded JSON { params: { inputJql, customParams? } }
 *   COPILOT_PAT   — PAT for GitHub REST except issue comments (create issue, dispatch, …)
 *   GITHUB_TOKEN  — ${{ github.token }} at job level (github-actions[bot]) for createComment only
 *
 * Modes (`AI_TEAMMATE_MODE`, required):
 *   pipeline_ci                  — CI default: config `params.steps` + optional async BA handoff; or resume (`AI_TEAMMATE_IS_RESUME=true`)
 *   codex_ba_create_github_issue — pipeline through `create_github_issue`; writes `ba-github-issue-prep.json`
 *   codex_ba_prepare_prompt      — read checkpoint; write BA Codex prompt + `ba-codex-state.json` (legacy split steps)
 *   codex_ba_prepare             — both phases in one process (local debug / compat)
 *   codex_ba_finish              — read Codex output + finish pipeline (legacy / resume debugging)
 *
 * Optional (CI): `AI_TEAMMATE_SKIP_BA_REASON` — when non-empty (from job output `skip_reason`), BA segment is skipped.
 */
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
import { getIssue, addIssueComment, addIssueLabel, transitionIssueToStatusName } from '../../lib/jira/jira-client.js';
import { fetchRelatedIssueSummaries } from '../../lib/jira/jira-related.js';
import { JIRA_CONTEXT_GITHUB_COMMENT_MARKER } from './jira-github-comment.js';
import {
  runCodexBaCreateGithubIssuePhase,
  runCodexBaPrepare,
  runCodexBaPreparePromptPhase,
  runCodexBaFinish,
} from './ai-teammate-codex-ba.js';
import { runPipelineCi } from './ai-teammate-pipeline.js';
import type { AiTeammateDeps } from './runner-types.js';

const PLACEHOLDER_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'github-issue-placeholder.md');
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
          const idx = body.indexOf(JIRA_CONTEXT_GITHUB_COMMENT_MARKER);
          latest = body.slice(idx + JIRA_CONTEXT_GITHUB_COMMENT_MARKER.length).replace(/^\s*\n/, '').trim();
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
        body: fillTemplate(PLACEHOLDER_TEMPLATE, { ISSUE_KEY: issueKey }),
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
  if (mode === 'codex_ba_create_github_issue') {
    await runCodexBaCreateGithubIssuePhase(deps);
    return;
  }
  if (mode === 'codex_ba_prepare_prompt') {
    await runCodexBaPreparePromptPhase(deps);
    return;
  }
  if (mode === 'codex_ba_prepare') {
    await runCodexBaPrepare(deps);
    return;
  }
  if (mode === 'codex_ba_finish') {
    await runCodexBaFinish(deps);
    return;
  }
  throw new Error(
    `AI_TEAMMATE_MODE must be "pipeline_ci", "codex_ba_create_github_issue", "codex_ba_prepare_prompt", "codex_ba_prepare", or "codex_ba_finish" (got "${mode || '(empty)'}").`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
