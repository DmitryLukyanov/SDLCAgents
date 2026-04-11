/**
 * Pipeline runner.
 *
 * Executes an ordered list of steps. Each step names a runner and carries its
 * own config. Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   ensure_jira_fields_expected  — validates Jira description; stops if empty
 *   print_jira_context_to_stdout — logs Jira ticket details + prepares spec-kit workspace (manifest or headless files)
 *   create_github_issue          — creates a GitHub issue placeholder; stores issue number in context
 *   run_ba_inline                — runs BA analysis inline; blocks + closes issue if incomplete
 *   assign_copilot               — fills prompt template with BA results + assigns Copilot to the GitHub issue
 *   dispatch_workflow            — dispatches a GitHub Actions workflow with the encoded config
 *
 * Adding a new runner:
 *   1. Create src/workflows/ai-teammate/steps/<name>.ts exporting a run<Name>() function
 *   2. Import it here and add a case to the switch below
 *   3. Add the step config type to PipelineStep union (runner-types.ts)
 */
import { join } from 'node:path';
import { runPrintJiraContextToStdout } from './steps/print-jira-context-to-stdout.js';
import { runEnsureJiraFieldsExpected } from './steps/ensure-jira-fields-expected.js';
import { runCreateGithubIssue } from './steps/create-github-issue.js';
import { runDispatchWorkflow } from './steps/dispatch-workflow.js';
import { runBaInline } from './steps/run-ba-inline.js';
import { runAssignCopilot } from './steps/assign-copilot.js';
import type { AiTeammateDeps, BaInlineStep, PipelineStep, RunnerContext, StepOutcome } from './runner-types.js';

/** spec-kit config as it appears on a print_jira_context_to_stdout pipeline step. */
interface SpecKitStepConfig {
  enabled?: boolean;
  cliEnabled?: boolean;
  outputDir?: string;
}

async function executeStep(ctx: RunnerContext, step: PipelineStep, deps: AiTeammateDeps): Promise<StepOutcome> {
  switch (step.runner) {
    case 'ensure_jira_fields_expected': {
      return runEnsureJiraFieldsExpected(ctx, step as unknown as Parameters<typeof runEnsureJiraFieldsExpected>[1], deps);
    }

    case 'print_jira_context_to_stdout': {
      // Optional spec-kit workspace prep (CLI manifest or headless markdown) before ticket logging.
      const sk = step.specKit as SpecKitStepConfig | undefined;
      if (sk?.enabled !== false) {
        await deps.prepareSpecKitWorkspace({
          issueKey: ctx.issueKey,
          cliEnabled: sk?.cliEnabled,
          ...(sk?.outputDir ? { outputDir: sk.outputDir } : {}),
        });
        ctx.specKitContextFile = join(process.cwd(), 'spec-output', ctx.issueKey, 'context.md');
      }
      await runPrintJiraContextToStdout(deps);
      return { status: 'continue' };
    }

    case 'create_github_issue': {
      return runCreateGithubIssue(ctx, deps);
    }

    case 'run_ba_inline': {
      return runBaInline(ctx, step as BaInlineStep, deps);
    }

    case 'assign_copilot': {
      return runAssignCopilot(ctx, deps);
    }

    case 'dispatch_workflow': {
      return runDispatchWorkflow(ctx, step, deps);
    }

    default:
      throw new Error(
        `Unknown pipeline step runner: "${step.runner}". ` +
          `Supported: ensure_jira_fields_expected, print_jira_context_to_stdout, create_github_issue, run_ba_inline, assign_copilot, dispatch_workflow.`,
      );
  }
}

const INLINE_RUNNERS = new Set([
  'ensure_jira_fields_expected',
  'print_jira_context_to_stdout',
  'create_github_issue',
  'run_ba_inline',
  'assign_copilot',
]);

interface StepRecord {
  runner: string;
  type: 'inline' | 'dispatched';
  status: 'continue' | 'stop';
  reason?: string;
  durationMs: number;
}

async function writeSummary(issueKey: string, repo: string, records: StepRecord[], ctx: RunnerContext): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const { appendFile } = await import('node:fs/promises');

  const icon = (s: StepRecord) => s.status === 'continue' ? '✅' : '🛑';
  const ms = (n: number) => n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`;

  const rows = records.map(r =>
    `| \`${r.runner}\` | ${r.type} | ${icon(r)} ${r.status}${r.reason ? ` — ${r.reason}` : ''} | ${ms(r.durationMs)} |`
  ).join('\n');

  const ghRepo = process.env.GITHUB_REPOSITORY ?? repo;
  const issueLink = ctx.githubIssueNumber
    ? `[#${ctx.githubIssueNumber}](https://github.com/${ghRepo}/issues/${ctx.githubIssueNumber})`
    : '—';

  const baStatus = ctx.baOutcome?.status === 'complete' ? '✅ complete'
    : ctx.baOutcome?.status === 'incomplete' ? '⚠️ incomplete'
    : '—';

  const finalStep = records.at(-1);
  const pipelineStatus = finalStep?.status === 'stop' ? '🛑 Halted' : '✅ Completed';

  const summary = [
    `## AI Teammate — ${issueKey}`,
    '',
    `**Status:** ${pipelineStatus} &nbsp;|&nbsp; **GitHub Issue:** ${issueLink} &nbsp;|&nbsp; **BA:** ${baStatus}`,
    '',
    '| Step | Type | Outcome | Duration |',
    '|------|------|---------|----------|',
    rows,
  ].join('\n');

  await appendFile(summaryPath, summary + '\n');
}

export async function runPipeline(
  issueKey: string,
  steps: PipelineStep[],
  deps: AiTeammateDeps,
  ctxInit: Omit<RunnerContext, 'issueKey' | 'githubIssueNumber' | 'specKitContextFile' | 'baOutcome'>,
): Promise<void> {
  const ctx: RunnerContext = { issueKey, ...ctxInit };
  const records: StepRecord[] = [];

  console.log(`\nPipeline starting for ${issueKey} (${steps.length} step(s))`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} ──`);

    const t0 = Date.now();
    const outcome = await executeStep(ctx, step, deps);
    const durationMs = Date.now() - t0;

    records.push({
      runner: step.runner,
      type: INLINE_RUNNERS.has(step.runner) ? 'inline' : 'dispatched',
      status: outcome.status,
      reason: outcome.status === 'stop' ? outcome.reason : undefined,
      durationMs,
    });

    if (outcome.status === 'stop') {
      console.log(`\n🛑 Pipeline halted at step ${i + 1} (${step.runner}): ${outcome.reason}`);
      await writeSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
      return;
    }
  }

  console.log(`\nPipeline finished all ${steps.length} step(s) for ${issueKey}.`);
  await writeSummary(issueKey, `${ctx.owner}/${ctx.repo}`, records, ctx);
}
