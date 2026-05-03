/**
 * AI Teammate CI entrypoint: GitHub Actions output **`skip_reason`** via
 * {@link evaluateSkipIfLabelFromConfigFile} (`src/lib/agent-skip-if-label.ts`).
 */
import { appendFileSync } from 'node:fs';
import { evaluateSkipIfLabelFromConfigFile } from '../../lib/agent-skip-if-label.js';
import { decodeCallerConfig, extractIssueKeyFromCallerConfig } from '../../lib/caller-config.js';

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `${name}=${value}\n`, 'utf8');
  }
  console.log(`[check-skip-if-label] ${name}=${value}`);
}

function assertConcurrencyKeyMatchesIssue(issueKey: string): void {
  const w = process.env.AI_TEAMMATE_CONCURRENCY_KEY?.trim();
  if (!w) return;
  if (w !== issueKey) {
    throw new Error(
      `concurrency_key "${w}" does not match issue key from CALLER_CONFIG "${issueKey}".`,
    );
  }
}

async function main(): Promise<void> {
  const configFile = process.env.CONFIG_FILE?.trim();
  const callerConfigEncoded = process.env.CALLER_CONFIG?.trim();
  if (!configFile) throw new Error('CONFIG_FILE is required');
  if (!callerConfigEncoded) throw new Error('CALLER_CONFIG is required');

  const root = decodeCallerConfig(callerConfigEncoded);
  const issueKey = extractIssueKeyFromCallerConfig(root);
  assertConcurrencyKeyMatchesIssue(issueKey);

  const { skipReason, skipIfLabel } = await evaluateSkipIfLabelFromConfigFile({
    configFilePath: configFile,
    issueKey,
  });

  if (skipReason && skipIfLabel) {
    console.log(
      `[check-skip-if-label] Jira ${issueKey} has label "${skipIfLabel}" — gated segment will be skipped in workflow.`,
    );
  }

  setOutput('skip_reason', skipReason);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
