/**
 * Local AI Teammate debug runner — emulated Jira data, no real API calls.
 * Run:   npm run ai-teammate:debug
 * Debug: set breakpoints in src/workflows/ai-teammate/ai-teammate-core.ts or steps/*.ts
 *
 * Edit ISSUE_KEY or the mock data below to experiment.
 */
import { runAiTeammateAgent } from '../../src/workflows/ai-teammate/ai-teammate-core.js';
import type { AiTeammateDeps } from '../../src/workflows/ai-teammate/runner-types.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const ISSUE_KEY = process.env.DEBUG_ISSUE_KEY?.trim() ?? 'SDLCSPAC-1';

process.env.CONFIG_FILE          ??= 'config/workflows/ai-teammate/ai-teammate.config';
process.env.ENCODED_CONFIG       ??= encodeURIComponent(JSON.stringify({ params: { inputJql: `key = ${ISSUE_KEY}` } }));
process.env.REQUIRED_JIRA_STATUS ??= 'To Do';
process.env.POST_READ_STATUS     ??= 'In Progress';
process.env.TICKET_CONTEXT_DEPTH ??= '1';

// ── Mock Jira data ─────────────────────────────────────────────────────────────
const mockDeps: AiTeammateDeps = {
  getIssue: async (key, _fields) => {
    console.log(`[mock] getIssue(${key})`);
    return {
      key,
      fields: {
        summary: 'Implement user authentication with OAuth2',
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'As a user, I want to log in via OAuth2 so that I can access the system securely. Acceptance criteria: token refresh works, logout clears session.' }],
            },
          ],
        },
        issuetype: { name: 'Story' },
        status: { name: 'To Do' },
        priority: { name: 'High' },
        assignee: { displayName: 'Jane Dev' },
        reporter: { displayName: 'John PM' },
        created: '2026-04-01T10:00:00.000Z',
        updated: '2026-04-08T15:30:00.000Z',
        comment: {
          comments: [
            {
              author: { displayName: 'John PM' },
              body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Please prioritise OAuth2 provider: Google and GitHub.' }] }] },
              created: '2026-04-02T09:00:00.000Z',
            },
          ],
        },
      },
    };
  },

  addIssueComment: async (key, comment) => {
    console.log(`[mock] addIssueComment(${key}): "${comment}"`);
  },

  transitionIssueToStatusName: async (key, status) => {
    console.log(`[mock] transitionIssueToStatusName(${key}) → "${status}"`);
  },

  fetchRelatedIssueSummaries: async (key, depth) => {
    console.log(`[mock] fetchRelatedIssueSummaries(${key}, depth=${depth})`);
    return [
      { key: 'SDLCSPAC-2', relation: 'child', summary: 'Set up OAuth2 provider config', status: 'To Do', issuetype: 'Sub-task' },
      { key: 'SDLCSPAC-3', relation: 'link',  summary: 'Auth service integration test',  status: 'To Do', issuetype: 'Test Case' },
    ];
  },

  prepareSpecKitWorkspace: async (opts) => {
    console.log(`[mock] prepareSpecKitWorkspace(${opts.issueKey}) — skipped in debug`);
  },

  addJiraIssueLabel: async (key, label) => {
    console.log(`[mock] addJiraIssueLabel(${key}, "${label}")`);
  },

  createGithubIssue: async (owner, repo, issueKey) => {
    console.log(`[mock] createGithubIssue(${owner}/${repo}, ${issueKey}) → 999`);
    return 999;
  },

  dispatchWorkflow: async (args) => {
    console.log(`[mock] dispatchWorkflow(${args.workflow_id})`);
  },

  analyzeTicket: async (ticketCtx) => {
    console.log(`[mock] analyzeTicket(${ticketCtx.issueKey}) → complete`);
    return {
      status: 'complete',
      result: {
        specifyInput: 'Mock specify input',
        clarifyInput: 'Mock clarify input',
        planInput: 'Mock plan input',
        tasksInput: 'Mock tasks input',
        implementInput: 'Mock implement input',
      },
    };
  },

  updateGithubIssue: async (owner, repo, issueNumber, payload) => {
    console.log(`[mock] updateGithubIssue(${owner}/${repo}#${issueNumber}): "${payload.body.slice(0, 60)}..."`);
  },

  closeGithubIssue: async (owner, repo, issueNumber) => {
    console.log(`[mock] closeGithubIssue(${owner}/${repo}#${issueNumber})`);
  },

  addGithubIssueComment: async (owner, repo, issueNumber, body) => {
    console.log(`[mock] addGithubIssueComment(${owner}/${repo}#${issueNumber}): "${body.slice(0, 60)}..."`);
  },

  githubToken: 'mock-token',
};

// ── Run ────────────────────────────────────────────────────────────────────────
console.log(`=== AI Teammate local debug · issue: ${ISSUE_KEY} ===\n`);
await runAiTeammateAgent(mockDeps);
console.log('\n=== Done ===');
