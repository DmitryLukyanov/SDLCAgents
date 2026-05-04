/**
 * Build merged Jira + spec-kit directive markdown for `spec-output/<issueKey>/issueContext.md`
 * (developer agent setup when Jira credentials are available).
 */
import { readFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getIssue as jiraGetIssue } from '../../../lib/jira/jira-client.js';
import type { JiraIssue } from '../../../lib/jira/jira-types.js';
import {
  getPostReadTargetStatus,
  getRequiredIssueStatus,
  statusAllowsRead,
} from '../../../lib/jira-status.js';
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import {
  fetchRelatedIssueSummaries as jiraFetchRelatedIssueSummaries,
  type RelatedIssueSummary,
} from '../../../lib/jira/jira-related.js';
import { parseSpecKitBlockFromPlainDescription } from './parse-jira-spec-kit.js';
import type { SpecKitDefaults } from './spec-kit-types.js';

const DEFAULTS_PATH = 'config/spec-kit/defaults.json';

async function loadDefaults(cwd: string): Promise<SpecKitDefaults> {
  const raw = await readFile(resolve(cwd, DEFAULTS_PATH), 'utf8');
  const j = JSON.parse(raw) as Partial<SpecKitDefaults>;
  const specify = typeof j.specify === 'string' && j.specify.trim() ? j.specify.trim() : '';
  const plan = typeof j.plan === 'string' && j.plan.trim() ? j.plan.trim() : '';
  const tasks = typeof j.tasks === 'string' && j.tasks.trim() ? j.tasks.trim() : '';
  const globalDirective =
    typeof j.globalDirective === 'string' && j.globalDirective.trim()
      ? j.globalDirective.trim()
      : undefined;
  if (!specify || !plan || !tasks) {
    throw new Error(`${DEFAULTS_PATH} must define non-empty specify, plan, and tasks strings`);
  }
  return { specify, plan, tasks, ...(globalDirective ? { globalDirective } : {}) };
}

function formatRelated(items: RelatedIssueSummary[]): string {
  if (items.length === 0) return '(none)';
  return items
    .map(
      (r) =>
        `- **${r.key}** (${r.relation}) [${r.issuetype ?? '?'} / ${r.status ?? '?'}]: ${r.summary ?? '(no summary)'}`,
    )
    .join('\n');
}

export interface PrepareContextOptions {
  issueKey: string;
  cwd?: string;
  ticketContextDepth?: number;
  /** Defaults to `jira-client` (production); tests inject `deps.getIssue`. */
  getIssue?: (key: string, fields: string[]) => Promise<JiraIssue>;
  /** Defaults to `jira-related` (production); tests inject `deps.fetchRelatedIssueSummaries`. */
  fetchRelatedIssueSummaries?: (key: string, depth: number) => Promise<RelatedIssueSummary[]>;
}

/**
 * Markdown body (Jira + merged directives from defaults and optional Jira fenced JSON).
 */
export async function buildIssueContextMarkdown(opts: PrepareContextOptions): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();

  const defaults = await loadDefaults(cwd);
  const getIssueFn = opts.getIssue ?? jiraGetIssue;
  const fetchRelatedFn = opts.fetchRelatedIssueSummaries ?? jiraFetchRelatedIssueSummaries;
  const issue = await getIssueFn(opts.issueKey, ['summary', 'description', 'status']);
  const statusName = issue.fields?.status?.name;
  if (!statusAllowsRead(statusName)) {
    throw new Error(
      `Refusing to build Jira context for ${opts.issueKey}: status is "${statusName ?? '(none)'}", ` +
        `allowed: "${getRequiredIssueStatus()}" or "${getPostReadTargetStatus()}" (see jira-status / env).`,
    );
  }
  const summary = issue.fields?.summary?.trim() || '(no summary)';
  const descPlain = adfToPlain(issue.fields?.description);

  const overrides = parseSpecKitBlockFromPlainDescription(descPlain);
  const merged = {
    specify: overrides.specify?.trim() || defaults.specify,
    plan: overrides.plan?.trim() || defaults.plan,
    tasks: overrides.tasks?.trim() || defaults.tasks,
    globalDirective:
      overrides.globalDirective?.trim() || defaults.globalDirective?.trim() || '',
  };

  const depth = opts.ticketContextDepth ?? 1;
  const related = depth >= 1 ? await fetchRelatedFn(opts.issueKey, depth) : [];

  const globalLines =
    merged.globalDirective.trim() === ''
      ? []
      : ['## Global directive (all agents)', '', merged.globalDirective.trim(), ''];

  return [
    `# Spec Kit Context: ${opts.issueKey}`,
    '',
    ...globalLines,
    '## Jira Issue',
    '',
    `**Key:** ${opts.issueKey}`,
    `**Summary:** ${summary}`,
    '',
    '### Description',
    '',
    descPlain || '(empty)',
    '',
    '## Related Issues',
    '',
    formatRelated(related),
    '',
    '## Spec Kit Directives',
    '',
    '### Specify (clarify)',
    '',
    merged.specify,
    '',
    '### Plan',
    '',
    merged.plan,
    '',
    '### Tasks',
    '',
    merged.tasks,
    '',
  ].join('\n');
}

/**
 * When `JIRA_BASE_URL` is set, writes `spec-output/<issueKey>/issueContext.md` in `cwd`.
 * Non-fatal on failure (missing defaults, Jira errors, etc.).
 */
export async function tryWriteSpecKitIssueContextFile(opts: {
  issueKey: string;
  cwd?: string;
  ticketContextDepth?: number;
}): Promise<void> {
  if (!process.env['JIRA_BASE_URL']?.trim()) {
    console.log('[spec-kit-context] JIRA_BASE_URL not set — skip issueContext.md');
    return;
  }
  const cwd = opts.cwd ?? process.cwd();
  try {
    const md = await buildIssueContextMarkdown({
      issueKey: opts.issueKey,
      cwd,
      ticketContextDepth: opts.ticketContextDepth,
    });
    const dir = join(cwd, 'spec-output', opts.issueKey);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, 'issueContext.md');
    writeFileSync(filePath, md.endsWith('\n') ? md : `${md}\n`, 'utf8');
    console.log(`[spec-kit-context] Wrote ${filePath}`);
  } catch (e) {
    console.warn('[spec-kit-context] Could not write issueContext.md (non-fatal):', e);
  }
}
