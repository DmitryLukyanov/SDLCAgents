/**
 * AI Teammate entry point: wires real deps and runs the agent.
 */
import { Octokit } from '@octokit/rest';
import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
import { getIssue, addIssueComment, addIssueLabel, transitionIssueToStatusName } from '../../lib/jira/jira-client.js';
import { fetchRelatedIssueSummaries } from '../../lib/jira/jira-related.js';
import { prepareIssueContextWithLogging } from './spec-kit/pipeline.js';
import { analyzeTicket } from '../business-analyst/analyze-ticket.js';
import { runAiTeammateAgent } from './ai-teammate-core.js';
import type { AiTeammateDeps } from './runner-types.js';

const PLACEHOLDER_TEMPLATE = loadTemplate(import.meta.url, 'templates', 'github-issue-placeholder.md');
const ISSUE_TITLE_TEMPLATE  = loadTemplate(import.meta.url, 'templates', 'github-issue-title.md');

const githubToken = process.env.COPILOT_PAT ?? process.env.GITHUB_TOKEN ?? '';
const octokit = new Octokit({ auth: githubToken });

const deps: AiTeammateDeps = {
  getIssue,
  addIssueComment,
  addJiraIssueLabel: addIssueLabel,
  transitionIssueToStatusName,
  fetchRelatedIssueSummaries,
  prepareSpecKitWorkspace: prepareIssueContextWithLogging,
  createGithubIssue: async (owner, repo, issueKey) => {
    await octokit.rest.issues.createLabel({
      owner, repo,
      name: `jira:${issueKey}`,
      color: '1d76db',
      description: `Jira ticket ${issueKey}`,
    }).catch(() => { /* label may already exist */ });

    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title: fillTemplate(ISSUE_TITLE_TEMPLATE, { ISSUE_KEY: issueKey }),
      body: fillTemplate(PLACEHOLDER_TEMPLATE, { ISSUE_KEY: issueKey }),
      labels: [`jira:${issueKey}`],
    });
    return response.data.number;
  },
  analyzeTicket,
  updateGithubIssue: async (owner, repo, issueNumber, payload) => {
    await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      owner,
      repo,
      issue_number: issueNumber,
      body: payload.body,
      assignees: payload.assignees,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agent_assignment: {
        custom_agent: 'sdlc.pipeline',
        custom_instructions: payload.agentInstructions,
      },
    });
  },
  closeGithubIssue: async (owner, repo, issueNumber) => {
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
      state_reason: 'not_planned',
    });
  },
  addGithubIssueComment: async (owner, repo, issueNumber, body) => {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  },
  githubToken,
  model: process.env.BA_MODEL?.trim() || undefined,
};

runAiTeammateAgent(deps).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
