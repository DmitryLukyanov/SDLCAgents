/**
 * Scrum Master CLI: reads env, wires real Jira + Octokit, calls runScrumMaster().
 */
import { Octokit } from '@octokit/rest';
import { addIssueComment, addIssueLabel, searchIssues, transitionIssueToStatusName, validateJiraAuth } from '../../lib/jira/jira-client.js';
import { getPostReadTargetStatus } from '../../lib/jira-status.js';
import { messages } from '../../lib/messages.js';
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
    try {
      await octokit.rest.actions.createWorkflowDispatch(args);
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : NaN;
      if (status === 404) {
        console.error(
          `   Hint (404): For workflow_dispatch, the workflow file must exist in the repo **at ref "${args.ref}"** ` +
            `(GitHub loads YAML from that commit). Push .github/workflows/${args.workflow_id} to that branch, ` +
            `or set workflowRef / GITHUB_REF_NAME to the branch that already contains it.`,
        );
        try {
          const { data: repoInfo } = await octokit.rest.repos.get({
            owner: args.owner,
            repo: args.repo,
          });
          if (repoInfo.default_branch !== args.ref) {
            console.error(
              `   This repo’s default branch on GitHub is "${repoInfo.default_branch}" (you dispatched "${args.ref}"). ` +
                `If the workflow only exists on the default branch, either merge into "${args.ref}" or point workflowRef at "${repoInfo.default_branch}".`,
            );
          }
        } catch {
          console.error(
            `   Could not read repo metadata — verify GITHUB_REPOSITORY=${args.owner}/${args.repo} and token has **repo** (classic) or Repository contents (fine-grained).`,
          );
        }
        try {
          const { data } = await octokit.rest.actions.listRepoWorkflows({
            owner: args.owner,
            repo: args.repo,
            per_page: 100,
          });
          const paths = data.workflows.map((w) => w.path.replace(/^\.github\/workflows\//, ''));
          console.error(
            `   Workflows GitHub knows about (${data.total_count}): ${paths.join(', ') || '(none — often means nothing pushed or no Actions permission)'}`,
          );
          const want = String(args.workflow_id);
          if (!paths.some((p) => p === want)) {
            console.error(
              `   "${want}" is not in that list — the file may never have been pushed, or the name differs from WORKFLOW_FILE / rule.workflowFile.`,
            );
          }
        } catch (e2: unknown) {
          const msg = e2 instanceof Error ? e2.message : String(e2);
          console.error(`   Could not list workflows: ${msg}`);
        }
      }
      if (status === 422) {
        const apiMsg =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof err.response === 'object' &&
          'data' in err.response &&
          err.response.data &&
          typeof err.response.data === 'object' &&
          'message' in err.response.data
            ? String((err.response.data as { message: unknown }).message)
            : '';
        if (apiMsg.includes('workflow_dispatch')) {
          console.error(
            `   Hint (422): GitHub is reading .github/workflows/${args.workflow_id} from **ref "${args.ref}"**. ` +
              `That version has no \`workflow_dispatch:\` (or YAML is invalid). Push the updated workflow to "${args.ref}" ` +
              `or set rule.workflowRef to the branch where \`on: workflow_dispatch\` is already present.`,
          );
        }
      }
      throw err;
    }
  },
};

validateJiraAuth()
  .then(() => runScrumMaster(ctx, deps))
  .catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
