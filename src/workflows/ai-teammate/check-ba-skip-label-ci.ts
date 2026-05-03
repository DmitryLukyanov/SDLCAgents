/**
 * CI helper: read `run_ba_inline.skipIfLabel` from CONFIG_FILE, fetch Jira labels, set GitHub Actions output **`skip_reason`** only.
 * **Empty `skip_reason`** → do not skip BA. **Non-empty** → skip Codex BA / prepare prompt (workflow uses this string; no `ba-codex-skip.json`).
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeEncodedConfig, extractIssueKeyFromEncoded } from '../../lib/encoded-config.js';
import { getIssue } from '../../lib/jira/jira-client.js';
import type { PipelineStep } from './runner-types.js';

interface AgentJson {
  params?: { steps?: PipelineStep[] };
}

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `${name}=${value}\n`, 'utf8');
  }
  console.log(`[check-ba-skip-label] ${name}=${value}`);
}

function assertConcurrencyKeyMatchesIssue(issueKey: string): void {
  const w = process.env.AI_TEAMMATE_CONCURRENCY_KEY?.trim();
  if (!w) return;
  if (w !== issueKey) {
    throw new Error(
      `concurrency_key "${w}" does not match issue key from ENCODED_CONFIG "${issueKey}".`,
    );
  }
}

async function main(): Promise<void> {
  const configFile = process.env.CONFIG_FILE?.trim();
  const encoded = process.env.ENCODED_CONFIG?.trim();
  if (!configFile) throw new Error('CONFIG_FILE is required');
  if (!encoded) throw new Error('ENCODED_CONFIG is required');

  const root = decodeEncodedConfig(encoded);
  const issueKey = extractIssueKeyFromEncoded(root);
  assertConcurrencyKeyMatchesIssue(issueKey);

  const abs = resolve(process.cwd(), configFile);
  const agent = JSON.parse(readFileSync(abs, 'utf8')) as AgentJson;
  const steps = agent.params?.steps ?? [];
  const baStep = steps.find(s => s.runner === 'run_ba_inline') as { skipIfLabel?: string } | undefined;
  const skipIfLabel = typeof baStep?.skipIfLabel === 'string' ? baStep.skipIfLabel.trim() : '';

  if (!skipIfLabel) {
    setOutput('skip_reason', '');
    return;
  }

  const issue = await getIssue(issueKey, ['labels']);
  const labels: string[] = (issue.fields as { labels?: string[] })?.labels ?? [];
  const hit = labels.includes(skipIfLabel);

  if (hit) {
    // Single-line, no double-quotes — safe for GITHUB_OUTPUT / env passthrough in YAML.
    setOutput('skip_reason', `already_labelled_${skipIfLabel.replace(/\s+/g, '_')}`);
    console.log(`[check-ba-skip-label] Jira ${issueKey} has label "${skipIfLabel}" — BA will be skipped in workflow.`);
  } else {
    setOutput('skip_reason', '');
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
