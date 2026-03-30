/**
 * AI Teammate core: CONFIG_FILE + ENCODED_CONFIG → run pipeline with injected deps.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  decodeEncodedConfig,
  extractIssueKeyFromEncoded,
} from '../../lib/encoded-config.js';
import { runPipeline } from './ai-teammate-pipeline.js';
import type { AiTeammateDeps, PipelineStep } from './runner-types.js';

interface AgentJson {
  name?: string;
  params?: {
    runner?: string;
    /** 0 = primary issue only; >=1 = linked issues + subtasks. */
    ticketContextDepth?: number;
    /** Pipeline runner: ordered list of steps with conditional routing. */
    steps?: PipelineStep[];
  };
}

export async function runAiTeammateAgent(deps: AiTeammateDeps): Promise<void> {
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

  if (runner === 'pipeline') {
    const steps = agent.params?.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new Error(`Pipeline runner requires a non-empty "steps" array in ${configFile}.`);
    }
    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '/').split('/');
    const ref = process.env.GITHUB_REF_NAME ?? 'main';
    const encoded = process.env.ENCODED_CONFIG?.trim() ?? '';
    await runPipeline(issueKey, steps, deps, { owner, repo, ref, encodedConfig: encoded, configFile: abs });
    return;
  }

  throw new Error(
    `Unknown params.runner "${runner}" in ${configFile}. Supported: pipeline`,
  );
}
