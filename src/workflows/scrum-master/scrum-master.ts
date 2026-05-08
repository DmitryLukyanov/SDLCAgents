/**
 * Scrum Master CLI: reads env, wires real Jira + Octokit, calls runScrumMaster().
 */
import { Octokit } from '@octokit/rest';
import { addIssueComment, addIssueLabel, searchIssues, transitionIssueToStatusName, validateJiraAuth } from '../../lib/jira/jira-client.js';
import { getPostReadTargetStatus } from '../../lib/jira-status.js';
import { messages } from '../../lib/messages.js';
import { dispatchGithubWorkflow, type GithubWorkflowDispatchPayload } from '../../lib/routing_helper.js';
import { runScrumMaster } from './scrum-master-core.js';

const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner || !repo) {
  throw new Error('GITHUB_REPOSITORY must be set (owner/repo)');
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GITHUB_TOKEN is required');
}

const ref = process.env.GITHUB_REF_NAME || 'main';
const globalLimit = Math.min(50, Math.max(1, parseInt(process.env.GLOBAL_LIMIT || '10', 10) || 10));
const rulesFile =
  process.env.RULES_FILE?.trim() || 'config/workflows/scrum-master/scrum-master.config';
const defaultWorkflowFile = process.env.WORKFLOW_FILE?.trim() || 'ai-teammate.yml';

const octokit = new Octokit({ auth: token });

const ctx = {
  owner,
  repo,
  ref,
  globalLimit,
  rulesFile,
  defaultWorkflowFile,
};

type WorkflowDispatchParams = NonNullable<
  Parameters<Octokit['rest']['actions']['createWorkflowDispatch']>[0]
>;

const deps = {
  searchIssues,
  addIssueLabel,
  transitionIssueToPostRead: async (issueKey: string) => {
    await transitionIssueToStatusName(issueKey, getPostReadTargetStatus());
    try {
      await addIssueComment(issueKey, messages.jira.takenIntoProcessingComment);
    } catch (e) {
      console.warn(`   ⚠️ Jira "taken into processing" comment failed for ${issueKey}:`, e);
    }
  },
  dispatchWorkflow: async (args: WorkflowDispatchParams) => {
    await dispatchGithubWorkflow(octokit, args as GithubWorkflowDispatchPayload);
  },
};

validateJiraAuth()
  .then(() => runScrumMaster(ctx, deps))
  .catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
