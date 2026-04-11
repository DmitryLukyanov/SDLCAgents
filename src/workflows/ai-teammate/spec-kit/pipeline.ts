/**
 * Prepares spec-kit workspace: writes issueContext.md + constitution.md from Jira issue data.
 */
import { prepareIssueContext, type PrepareContextOptions } from './issue-context.js';
import { resolve } from 'node:path';

/** Options for preparing spec-kit workspace files. */
export interface IssueContextPrepOptions {
  cwd?: string;
  issueKey: string;
  /** Override output root (default: spec-output/<issueKey>) */
  outputDir?: string;
  /** Ticket context depth for related issues (default 1). */
  ticketContextDepth?: number;
}

export async function prepareIssueContextWithLogging(opts: IssueContextPrepOptions): Promise<void> {
  console.log('\n=== Spec Kit pipeline (CLI mode — preparing issueContext.md + constitution.md) ===');
  const ctxOpts: PrepareContextOptions = {
    issueKey: opts.issueKey,
    cwd: opts.cwd,
    outputDir: opts.outputDir ? resolve(opts.cwd ?? process.cwd(), opts.outputDir) : undefined,
    ticketContextDepth: opts.ticketContextDepth,
  };
  const result = await prepareIssueContext(ctxOpts);
  console.log(`  → context:      ${result.contextFile}`);
  console.log(`  → constitution:  ${result.constitutionFile}`);
  console.log('  ✅ Ready\n');
}
