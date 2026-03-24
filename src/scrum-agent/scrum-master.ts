/**
 * Scrum Master CLI: reads env, wires real Jira + Octokit, calls runScrumMasterWithRulesOrSingleJql().
 */
import { Octokit } from '@octokit/rest';
import { addIssueLabel, searchIssues, transitionIssueToStatusName } from '../jira/jira-client.js';
import { getPostReadTargetStatus } from '../lib/jira-status.js';
import { runScrumMasterWithRulesOrSingleJql } from './scrum-master-core.js';

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
const smRulesFile = process.env.SM_RULES_FILE?.trim() || 'config/sm.json';
const legacyJql = process.env.JQL?.trim() || undefined;
const legacyConfigFile =
  process.env.AGENT_CONFIG_FILE?.trim() || 'config/agents/dummy-ticket-agent.json';
const defaultWorkflowFile = process.env.WORKFLOW_FILE?.trim() || 'ai-teammate.yml';

const octokit = new Octokit({ auth: token });

const ctx = {
  owner,
  repo,
  ref,
  globalLimit,
  smRulesFile,
  legacyJql,
  legacyConfigFile,
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
      throw err;
    }
  },
};

runScrumMasterWithRulesOrSingleJql(ctx, deps).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
