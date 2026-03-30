/**
 * Business Analyst CLI: reads env, wires real Jira + Octokit, calls runBusinessAnalyst().
 */
import { Octokit } from '@octokit/rest';
import {
  addIssueComment,
  addIssueLabel,
  getIssue,
  transitionIssueToStatusName,
  validateJiraAuth,
} from '../../lib/jira/jira-client.js';
import { fetchRelatedIssueSummaries } from '../../lib/jira/jira-related.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractIssueKeyFromEncoded, decodeEncodedConfig } from '../../lib/encoded-config.js';
import { analyzeTicket } from './analyze-ticket.js';
import { runBaPipeline } from './ba-pipeline.js';
import type { BaPipelineParams } from './ba-runner-types.js';

/* ------------------------------------------------------------------ */
/*  Environment                                                        */
/* ------------------------------------------------------------------ */

const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner || !repo) {
  throw new Error('GITHUB_REPOSITORY must be set (owner/repo)');
}

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error('GITHUB_TOKEN is required');
}

const ref = process.env.GITHUB_REF_NAME || 'main';

const configFile = process.env.CONFIG_FILE?.trim();
if (!configFile) throw new Error('CONFIG_FILE is required');

const encodedConfig = process.env.ENCODED_CONFIG?.trim();
if (!encodedConfig) throw new Error('ENCODED_CONFIG is required');

const root = decodeEncodedConfig(encodedConfig);
const issueKey = extractIssueKeyFromEncoded(root);

const custom = root.params?.customParams ?? {};
const ticketContextDepth = parseInt(custom.ticket_context_depth ?? '1', 10) || 1;

const model = process.env.BA_MODEL?.trim() || undefined;
const aiTeammateWorkflowFile = process.env.AI_TEAMMATE_WORKFLOW?.trim() || 'ai-teammate.yml';
const blockedStatusName = process.env.BA_BLOCKED_STATUS?.trim() || 'Blocked';
const analyzedLabel = process.env.BA_ANALYZED_LABEL?.trim() || 'ba_analyzed';

/* ------------------------------------------------------------------ */
/*  Wire dependencies                                                  */
/* ------------------------------------------------------------------ */

const octokit = new Octokit({ auth: githubToken });

const ctx = {
  owner,
  repo,
  ref,
  issueKey,
  configFile,
  encodedConfig,
  model,
  ticketContextDepth,
  aiTeammateWorkflowFile,
  blockedStatusName,
  analyzedLabel,
};

const deps = {
  getIssue,
  addIssueComment,
  addIssueLabel,
  transitionIssueToStatusName,
  fetchRelatedIssueSummaries,
  analyzeTicket,
  githubToken,
  dispatchWorkflow: async (args: Parameters<typeof octokit.rest.actions.createWorkflowDispatch>[0]) => {
    await octokit.rest.actions.createWorkflowDispatch(args);
  },
};

/* ------------------------------------------------------------------ */
/*  Run                                                                */
/* ------------------------------------------------------------------ */

validateJiraAuth()
  .then(async () => {
    const abs = resolve(process.cwd(), configFile);
    const raw = await readFile(abs, 'utf8');
    const agentConfig = JSON.parse(raw) as { params?: BaPipelineParams };
    const runner = agentConfig.params?.runner?.trim();

    if (runner !== 'pipeline') {
      throw new Error(`Unsupported runner "${runner}" in ${configFile}. Only "pipeline" is supported.`);
    }

    const steps = agentConfig.params?.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new Error(`Pipeline runner requires a non-empty "steps" array in ${configFile}.`);
    }
    await runBaPipeline(ctx, steps, deps);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
