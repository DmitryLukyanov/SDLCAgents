/**
 * Headless Spec Kit-style pipeline: materialize constitution, spec, plan, tasks
 * from a Jira issue + config/spec-kit/defaults.json. Does not invoke external
 * Specify CLI (that toolkit is agent-interactive); this matches the same artifacts
 * for CI until an AI step is wired.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getIssue } from '../jira/jira-client.js';
import { adfToPlain } from '../dummy-agent/adf-to-plain.js';
import type { SpecKitDefaults, SpecKitJiraOverrides } from './spec-kit-types.js';
import { parseSpecKitBlockFromPlainDescription } from './parse-jira-spec-kit.js';

const CONSTITUTION_SOURCE = 'config/spec-kit/constitution.md';
const DEFAULTS_PATH = 'config/spec-kit/defaults.json';

function mergeStrings(
  base: SpecKitDefaults,
  overrides: SpecKitJiraOverrides,
): SpecKitDefaults {
  return {
    specify: overrides.specify?.trim() || base.specify,
    plan: overrides.plan?.trim() || base.plan,
    tasks: overrides.tasks?.trim() || base.tasks,
  };
}

async function loadDefaults(cwd: string): Promise<SpecKitDefaults> {
  const raw = await readFile(resolve(cwd, DEFAULTS_PATH), 'utf8');
  const j = JSON.parse(raw) as Partial<SpecKitDefaults>;
  const specify = typeof j.specify === 'string' && j.specify.trim() ? j.specify.trim() : '';
  const plan = typeof j.plan === 'string' && j.plan.trim() ? j.plan.trim() : '';
  const tasks = typeof j.tasks === 'string' && j.tasks.trim() ? j.tasks.trim() : '';
  if (!specify || !plan || !tasks) {
    throw new Error(`${DEFAULTS_PATH} must define non-empty specify, plan, and tasks strings`);
  }
  return { specify, plan, tasks };
}

export interface RunSpecKitPipelineOptions {
  cwd?: string;
  issueKey: string;
  /** Override output root (default: spec-output/<issueKey>) */
  outputDir?: string;
}

export async function runSpecKitPipeline(opts: RunSpecKitPipelineOptions): Promise<string> {
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

  const specBody = [
    '# Specification',
    '',
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
    merged.plan,
    '',
    `_Jira: ${opts.issueKey}_`,
    '',
  ].join('\n');

  const tasksBody = [
    '# Tasks (Spec Kit — tasks)',
    '',
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

/** Log phases for Actions / local runs. */
export async function runSpecKitPipelineWithLogging(opts: RunSpecKitPipelineOptions): Promise<void> {
  const phases = ['constitution', 'specify (spec.md)', 'plan (plan.md)', 'tasks (tasks.md)'] as const;
  console.log('\n=== Spec Kit pipeline (headless artifacts) ===');
  for (const p of phases) {
    console.log(`  → ${p}`);
  }
  const dir = await runSpecKitPipeline(opts);
  console.log(`  ✅ Wrote: ${dir}/constitution.md, spec.md, plan.md, tasks.md\n`);
}
