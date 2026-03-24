/**
 * Generic workflow entry: CONFIG_FILE + ENCODED_CONFIG → run agent by runner id.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDummyTicketAgent } from '../dummy-agent/dummy-agent.js';
import {
  decodeEncodedConfig,
  extractIssueKeyFromEncoded,
} from '../lib/encoded-config.js';
import { runSpecKitPipelineWithLogging } from '../spec-kit/pipeline.js';

interface AgentJson {
  name?: string;
  params?: {
    runner?: string;
    /** 0 = primary issue only; >=1 = linked issues + subtasks. */
    ticketContextDepth?: number;
    /** When enabled, runs Spec Kit artifact pipeline (constitution, spec, plan, tasks) before the runner. */
    specKit?: {
      enabled?: boolean;
      /** Relative to repo root; default spec-output/<ISSUE_KEY> */
      outputDir?: string;
      /** Use real specify-cli instead of headless templates. */
      cliEnabled?: boolean;
      /** Git tag for specify-cli (e.g. "v0.4.0"). */
      version?: string;
      /** AI agent backend (e.g. "copilot"). */
      agent?: string;
      /** Script type for specify init (e.g. "sh"). */
      scriptType?: string;
    };
  };
}

async function main(): Promise<void> {
  const configFile = process.env.CONFIG_FILE?.trim();
  const encoded = process.env.ENCODED_CONFIG?.trim();
  if (!configFile) throw new Error('CONFIG_FILE is required');
  if (!encoded) throw new Error('ENCODED_CONFIG is required');

  const root = decodeEncodedConfig(encoded);
  const issueKey = extractIssueKeyFromEncoded(root);
  const custom = root.params?.customParams ?? {};

  const abs = resolve(process.cwd(), configFile);
  const raw = await readFile(abs, 'utf8');
  const agent = JSON.parse(raw) as AgentJson;
  const runner = agent.params?.runner?.trim();

  process.env.ISSUE_KEY = issueKey;
  const ts = custom.taken_status?.trim();
  const ms = custom.status_to_move_to?.trim();
  if (ts) process.env.REQUIRED_JIRA_STATUS = ts;
  if (ms) process.env.POST_READ_STATUS = ms;

  const depthFromCustom = custom.ticket_context_depth;
  const depthParsed =
    depthFromCustom !== undefined && depthFromCustom !== ''
      ? parseInt(String(depthFromCustom), 10)
      : NaN;
  const depthFromAgent = agent.params?.ticketContextDepth;
  /** Prefer workflow/custom param, then agent JSON; default 1 keeps related-ticket context on. */
  const depth =
    !Number.isNaN(depthParsed) && depthParsed >= 0
      ? depthParsed
      : typeof depthFromAgent === 'number' && depthFromAgent >= 0
        ? depthFromAgent
        : 1;
  process.env.TICKET_CONTEXT_DEPTH = String(depth);

  console.log(
    `Agent runner: ${runner ?? '(missing)'} · config: ${configFile} · key: ${issueKey} · ticketContextDepth: ${depth}`,
  );

  const specKitEnabled =
    runner === 'dummy_ticket'
      ? agent.params?.specKit?.enabled !== false
      : agent.params?.specKit?.enabled === true;

  if (specKitEnabled) {
    const sk = agent.params?.specKit;
    const outDir = sk?.outputDir?.trim();
    await runSpecKitPipelineWithLogging({
      issueKey,
      ...(outDir ? { outputDir: resolve(process.cwd(), outDir) } : {}),
      cliEnabled: sk?.cliEnabled,
      ticketContextDepth: depth,
      cliVersion: sk?.version,
      cliAgent: sk?.agent,
      cliScriptType: sk?.scriptType,
    });
  }

  if (runner === 'dummy_ticket') {
    await runDummyTicketAgent();
    return;
  }

  throw new Error(
    `Unknown params.runner "${runner}" in ${configFile}. Supported: dummy_ticket`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
