/**
 * Local Scrum Master dry-run: mock Jira search + GitHub dispatch (no network).
 * Run: npm run scrum-master:debug
 * Debug: set breakpoints in src/scrum-agent/scrum-master-core.ts or here.
 */
import type { JiraSearchResponse } from '../../src/jira/jira-types.js';
import {
  runScrumMasterWithRulesOrSingleJql,
  type ScrumMasterDeps,
} from '../../src/scrum-agent/scrum-master-core.js';

process.env.REQUIRED_JIRA_STATUS ??= 'To Do';
process.env.POST_READ_STATUS ??= 'In Progress';
process.env.TICKET_CONTEXT_DEPTH ??= '1';

/** Canned Jira search results — edit to experiment in the debugger. */
const mockSearchIssues = async (
  jql: string,
  maxResults: number,
  fields: string[],
): Promise<JiraSearchResponse> => {
  console.log(`[mock] searchIssues jql=${JSON.stringify(jql)} max=${maxResults} fields=${fields.join(',')}`);
  return {
    total: 2,
    issues: [
      { key: 'DEBUG-1', fields: { labels: [] } },
      {
        key: 'DEBUG-2',
        fields: { labels: ['sm_dummy_triggered'] },
      },
    ],
  };
};

const dispatchLog: unknown[] = [];
const labelLog: string[][] = [];

const mockDeps: ScrumMasterDeps = {
  searchIssues: mockSearchIssues,
  addIssueLabel: async (issueKey, label) => {
    labelLog.push([issueKey, label]);
    console.log(`[mock] addIssueLabel ${issueKey} +${label}`);
  },
  transitionIssueToPostRead: async (issueKey) => {
    console.log(`[mock] transitionIssueToPostRead ${issueKey}`);
  },
  dispatchWorkflow: async (args) => {
    dispatchLog.push(args);
    console.log(`[mock] dispatchWorkflow`, JSON.stringify(args, null, 2));
  },
};

const ctx = {
  owner: 'debug-owner',
  repo: 'debug-repo',
  ref: 'main',
  globalLimit: 10,
  smRulesFile: 'config/fixtures/sm-debug.json',
  legacyJql: undefined as string | undefined,
  legacyConfigFile: 'config/agents/dummy-ticket-agent.json',
  defaultWorkflowFile: 'ai-teammate.yml',
};

async function main(): Promise<void> {
  const legacy = process.env.SCRUM_LOCAL_LEGACY === '1' || process.env.SCRUM_LOCAL_LEGACY === 'true';
  if (legacy) {
    ctx.legacyJql = 'project = DEBUG AND status = "To Do"';
    ctx.smRulesFile = 'config/fixtures/sm-debug.json';
  }

  console.log('=== Scrum Master local test (mocks) ===\n');
  await runScrumMasterWithRulesOrSingleJql(ctx, mockDeps);

  console.log('\n--- Summary ---');
  console.log(`dispatchWorkflow calls: ${dispatchLog.length}`);
  console.log(`addIssueLabel calls: ${labelLog.length}`);
  if (labelLog.length) console.log('labels:', labelLog);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
