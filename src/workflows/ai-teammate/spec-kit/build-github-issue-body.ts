/**
 * Prepare Jira context + manifest for the real spec-kit CLI.
 * Node writes seed files; workflow shell steps run `specify` commands.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getIssue } from '../../../lib/jira/jira-client.js';
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import { fetchRelatedIssueSummaries, type RelatedIssueSummary } from '../../../lib/jira/jira-related.js';
import { parseSpecKitBlockFromPlainDescription } from './parse-jira-spec-kit.js';
import type { SpecKitCliConfig, SpecKitDefaults, SpecKitManifest } from './spec-kit-types.js';

const CONSTITUTION_SOURCE = 'config/spec-kit/constitution.md';
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
    .map((r) => `- **${r.key}** (${r.relation}) [${r.issuetype ?? '?'} / ${r.status ?? '?'}]: ${r.summary ?? '(no summary)'}`)
    .join('\n');
}

export interface PrepareContextOptions {
  issueKey: string;
  cwd?: string;
  outputDir?: string;
  ticketContextDepth?: number;
  cli: Required<Pick<SpecKitCliConfig, 'version' | 'agent' | 'scriptType'>>;
}

export interface PrepareContextResult {
  contextFile: string;
  constitutionFile: string;
  outputDir: string;
  manifestFile: string;
}

export async function prepareSpecKitContext(opts: PrepareContextOptions): Promise<PrepareContextResult> {
  const cwd = opts.cwd ?? process.cwd();
  const outRoot = opts.outputDir ?? join(cwd, 'spec-output', opts.issueKey);
  await mkdir(outRoot, { recursive: true });

  // Copy constitution
  const constitutionSrc = resolve(cwd, CONSTITUTION_SOURCE);
  const constitutionDest = join(outRoot, 'constitution.md');
  await copyFile(constitutionSrc, constitutionDest);

  // Load defaults + Jira issue
  const defaults = await loadDefaults(cwd);
  const issue = await getIssue(opts.issueKey, ['summary', 'description']);
  const summary = issue.fields?.summary?.trim() || '(no summary)';
  const descPlain = adfToPlain(issue.fields?.description);

  // Parse overrides and merge
  const overrides = parseSpecKitBlockFromPlainDescription(descPlain);
  const merged = {
    specify: overrides.specify?.trim() || defaults.specify,
    plan: overrides.plan?.trim() || defaults.plan,
    tasks: overrides.tasks?.trim() || defaults.tasks,
    globalDirective:
      overrides.globalDirective?.trim() || defaults.globalDirective?.trim() || '',
  };

  // Related issues
  const depth = opts.ticketContextDepth ?? 1;
  const related = depth >= 1
    ? await fetchRelatedIssueSummaries(opts.issueKey, depth)
    : [];

  const globalLines =
    merged.globalDirective.trim() === ''
      ? []
      : ['## Global directive (all agents)', '', merged.globalDirective.trim(), ''];

  // Build context markdown
  const contextBody = [
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

  const contextFile = join(outRoot, 'context.md');
  await writeFile(contextFile, contextBody, 'utf8');

  // Write manifest for workflow shell steps
  const manifest: SpecKitManifest = {
    issueKey: opts.issueKey,
    contextFile,
    constitutionFile: constitutionDest,
    outputDir: outRoot,
    version: opts.cli.version,
    agent: opts.cli.agent,
    scriptType: opts.cli.scriptType,
  };

  const manifestFile = join(outRoot, 'manifest.json');
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

  return { contextFile, constitutionFile: constitutionDest, outputDir: outRoot, manifestFile };
}
