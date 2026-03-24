/**
 * Pipeline runner.
 *
 * Executes an ordered list of steps. Each step names a runner and carries its
 * own config. Execution stops as soon as any step returns { status: 'stop' }.
 *
 * Supported step runners:
 *   check_description — validates Jira description; stops if empty
 *   dummy_ticket      — logs Jira ticket details + runs spec-kit context prep
 *   confirmation      — prints a completion message
 *
 * Adding a new runner:
 *   1. Create src/runners/<name>.ts exporting a run<Name>() function
 *   2. Import it here and add a case to the switch below
 *   3. Add the step config type to PipelineStep union (runner-types.ts)
 */
import { runDummyTicketAgent } from '../dummy-agent/dummy-agent.js';
import { runSpecKitPipelineWithLogging } from '../spec-kit/pipeline.js';
import { runCheckDescription } from './check-description.js';
import { runConfirmation } from './confirmation.js';
import type { PipelineStep, RunnerContext, StepOutcome } from './runner-types.js';

/** spec-kit config as it appears on a dummy_ticket pipeline step. */
interface SpecKitStepConfig {
  enabled?: boolean;
  cliEnabled?: boolean;
  version?: string;
  agent?: string;
  scriptType?: string;
  outputDir?: string;
}

async function executeStep(ctx: RunnerContext, step: PipelineStep): Promise<StepOutcome> {
  switch (step.runner) {
    case 'check_description': {
      return runCheckDescription(ctx, step as unknown as Parameters<typeof runCheckDescription>[1]);
    }

    case 'dummy_ticket': {
      // Optional spec-kit context preparation before the dummy agent runs.
      const sk = step.specKit as SpecKitStepConfig | undefined;
      if (sk?.enabled !== false) {
        await runSpecKitPipelineWithLogging({
          issueKey: ctx.issueKey,
          cliEnabled: sk?.cliEnabled,
          ...(sk?.outputDir ? { outputDir: sk.outputDir } : {}),
          cliVersion: sk?.version,
          cliAgent: sk?.agent,
          cliScriptType: sk?.scriptType,
        });
      }
      await runDummyTicketAgent();
      return { status: 'continue' };
    }

    case 'confirmation': {
      return runConfirmation(ctx, step as unknown as Parameters<typeof runConfirmation>[1]);
    }

    default:
      throw new Error(
        `Unknown pipeline step runner: "${step.runner}". ` +
          `Supported: check_description, dummy_ticket, confirmation.`,
      );
  }
}

export async function runPipeline(issueKey: string, steps: PipelineStep[]): Promise<void> {
  const ctx: RunnerContext = { issueKey };

  console.log(`\nPipeline starting for ${issueKey} (${steps.length} step(s))`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n── Step ${i + 1}/${steps.length}: ${step.runner} ──`);

    const outcome = await executeStep(ctx, step);

    if (outcome.status === 'stop') {
      console.log(`\n🛑 Pipeline halted at step ${i + 1} (${step.runner}): ${outcome.reason}`);
      return;
    }
  }

  console.log(`\nPipeline finished all ${steps.length} step(s) for ${issueKey}.`);
}
