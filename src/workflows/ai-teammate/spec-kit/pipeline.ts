/**
 * Spec Kit workspace prep — two modes (see {@link prepareSpecKitWorkspaceWithLogging}):
 *
 * 1. **Headless**: {@link writeSpecKitHeadlessArtifacts} — writes constitution + spec.md, plan.md, tasks.md
 *    from a Jira issue + config/spec-kit/defaults.json (no specify CLI).
 * 2. **CLI** (`cliEnabled: true`): {@link prepareIssueContext} via prepareSpecKitWorkspaceWithLogging —
 *    context.md + constitution.md for the real `specify` CLI.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getIssue } from '../../../lib/jira/jira-client.js';
import { adfToPlain } from '../../../lib/adf-to-plain.js';
import type { SpecKitDefaults, SpecKitJiraOverrides } from './spec-kit-types.js';
import { parseSpecKitBlockFromPlainDescription } from './parse-jira-spec-kit.js';
import { prepareIssueContext, type PrepareContextOptions } from './issue-context.js';

const CONSTITUTION_SOURCE = 'config/spec-kit/constitution.md';
const DEFAULTS_PATH = 'config/spec-kit/defaults.json';

function mergeStrings(
  base: SpecKitDefaults,
  overrides: SpecKitJiraOverrides,
): SpecKitDefaults {
  const globalDirective =
    overrides.globalDirective?.trim() || base.globalDirective?.trim() || undefined;
  return {
    specify: overrides.specify?.trim() || base.specify,
    plan: overrides.plan?.trim() || base.plan,
    tasks: overrides.tasks?.trim() || base.tasks,
    ...(globalDirective ? { globalDirective } : {}),
  };
}

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

/** Options for preparing spec-kit workspace files (CLI manifest path vs headless markdown). */
export interface SpecKitWorkspacePrepOptions {
  cwd?: string;
  issueKey: string;
  /** Override output root (default: spec-output/<issueKey>) */
  outputDir?: string;
  /** When true, prepare context + constitution for the real specify CLI instead of writing templates. */
  cliEnabled?: boolean;
  /** Ticket context depth for related issues (default 1). */
  ticketContextDepth?: number;
}

/**
 * Writes headless spec-kit markdown (constitution + spec.md, plan.md, tasks.md) from Jira + defaults.
 * Does not invoke the specify CLI; returns the output directory path.
 */
export async function writeSpecKitHeadlessArtifacts(opts: SpecKitWorkspacePrepOptions): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();
  const outRoot = opts.outputDir ?? join(cwd, 'spec-output', opts.issueKey);
  await mkdir(outRoot, { recursive: true });

  const constitutionSrc = resolve(cwd, CONSTITUTION_SOURCE);
  const constitutionDest = join(outRoot, 'constitution.md');
  await copyFile(constitutionSrc, constitutionDest);

  const defaults = await loadDefaults(cwd);
  const issue = await getIssue(opts.issueKey, ['summary', 'description']);
  const summary = issue.fields?.summary?.trim() || '(no summary)';
  const descPlain = adfToPlain(issue.fields?.description);
  const overrides = parseSpecKitBlockFromPlainDescription(descPlain);
  const merged = mergeStrings(defaults, overrides);

  const globalBlock =
    merged.globalDirective?.trim() === undefined || merged.globalDirective.trim() === ''
      ? []
      : ['## Global directive (all agents)', '', merged.globalDirective.trim(), ''];

  const specBody = [
    '# Specification',
    '',
    ...globalBlock,
    '## Intent (Spec Kit — specify)',
    '',
    merged.specify,
    '',
    `## Source: Jira ${opts.issueKey}`,
    '',
    '### Summary',
    '',
    summary,
    '',
    '### Description',
    '',
    descPlain || '(empty)',
    '',
  ].join('\n');

  const planBody = [
    '# Implementation plan (Spec Kit — plan)',
    '',
    ...globalBlock,
    merged.plan,
    '',
    `_Jira: ${opts.issueKey}_`,
    '',
  ].join('\n');

  const tasksBody = [
    '# Tasks (Spec Kit — tasks)',
    '',
    ...globalBlock,
    merged.tasks,
    '',
    `_Jira: ${opts.issueKey}_`,
    '',
  ].join('\n');

  await writeFile(join(outRoot, 'spec.md'), specBody, 'utf8');
  await writeFile(join(outRoot, 'plan.md'), planBody, 'utf8');
  await writeFile(join(outRoot, 'tasks.md'), tasksBody, 'utf8');

  return outRoot;
}

/**
 * Prepares spec-kit workspace output: either CLI context + manifest (for workflow shell steps)
 * or headless markdown artifacts via {@link writeSpecKitHeadlessArtifacts}.
 */
export async function prepareSpecKitWorkspaceWithLogging(opts: SpecKitWorkspacePrepOptions): Promise<void> {
  if (opts.cliEnabled) {
    console.log('\n=== Spec Kit pipeline (CLI mode — preparing context + manifest) ===');
    const ctxOpts: PrepareContextOptions = {
      issueKey: opts.issueKey,
      cwd: opts.cwd,
      outputDir: opts.outputDir ? resolve(opts.cwd ?? process.cwd(), opts.outputDir) : undefined,
      ticketContextDepth: opts.ticketContextDepth,
    };
    const result = await prepareIssueContext(ctxOpts);
    console.log(`  → context:      ${result.contextFile}`);
    console.log(`  → constitution:  ${result.constitutionFile}`);
    console.log('  ✅ CLI mode ready — workflow shell steps will run specify commands.\n');
    return;
  }

  const phases = ['constitution', 'specify (spec.md)', 'plan (plan.md)', 'tasks (tasks.md)'] as const;
  console.log('\n=== Spec Kit pipeline (headless artifacts) ===');
  for (const p of phases) {
    console.log(`  → ${p}`);
  }
  const dir = await writeSpecKitHeadlessArtifacts(opts);
  console.log(`  ✅ Wrote: ${dir}/constitution.md, spec.md, plan.md, tasks.md\n`);
}
