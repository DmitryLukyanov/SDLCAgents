/**
 * AI Teammate core: CONFIG_FILE + ENCODED_CONFIG → pipeline metadata for Codex BA phases.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  decodeEncodedConfig,
  extractIssueKeyFromEncoded,
} from '../../lib/encoded-config.js';
import type { PipelineStep, RunnerContext } from './runner-types.js';

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

export interface LoadedAiTeammatePipeline {
  issueKey: string;
  steps: PipelineStep[];
  ctxInit: Omit<RunnerContext, 'issueKey' | 'githubIssueNumber' | 'specKitContextFile' | 'baOutcome'>;
  configFileAbs: string;
  runner: string;
}

/** Load CONFIG_FILE + ENCODED_CONFIG into pipeline metadata (Codex BA prepare/finish). */
export async function loadAiTeammatePipelineFromEnv(): Promise<LoadedAiTeammatePipeline> {
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
  const runner = agent.params?.runner?.trim() ?? '';

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

  const steps = agent.params?.steps;
  if (runner === 'pipeline') {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new Error(`Pipeline runner requires a non-empty "steps" array in ${configFile}.`);
    }
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '/').split('/');
  const ref = process.env.GITHUB_REF_NAME ?? 'main';

  console.log(
    `Agent runner: ${runner || '(missing)'} · config: ${configFile} · key: ${issueKey} · ticketContextDepth: ${depth}`,
  );

  return {
    issueKey,
    steps: (steps ?? []) as PipelineStep[],
    ctxInit: { owner, repo, ref, encodedConfig: encoded, configFile: abs },
    configFileAbs: abs,
    runner,
  };
}
