/**
 * LLM provider for the speckit-developer-agent **fix** workflow (local Codex CLI).
 *
 * `openai/codex-action@v1` is used in GitHub Actions; this module supports the
 * fix script path that invokes `codex exec` directly.
 *
 * Model: `getEffectiveModel(tryLoadConfig())` (config `params.model`, then env — see speckit-developer-agent-config).
 *
 * Environment variables:
 *   OPENAI_API_KEY         — required for Codex CLI
 */

import { spawnSync } from 'node:child_process';

import { getEffectiveModel, tryLoadConfig } from './speckit-developer-agent-config.js';

/* ------------------------------------------------------------------ */
/*  Interface                                                          */
/* ------------------------------------------------------------------ */

export interface LlmProvider {
  readonly description: string;
  complete(systemPrompt: string, userMessage: string): Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  File block parser                                                  */
/* ------------------------------------------------------------------ */

export function parseFileBlocks(response: string): Map<string, string> {
  const files = new Map<string, string>();
  const regex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(response)) !== null) {
    files.set(match[1], match[2].replace(/^\n/, '').replace(/\n$/, ''));
  }
  return files;
}

/* ------------------------------------------------------------------ */
/*  Codex CLI provider                                                 */
/* ------------------------------------------------------------------ */

const CODEX_TIMEOUT_MS = 600_000;

class CodexCliProvider implements LlmProvider {
  readonly description: string;

  constructor(private readonly model: string) {
    this.description = `codex-cli / ${model}`;
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    if (!process.env['OPENAI_API_KEY']) {
      throw new Error(
        'CodexCliProvider: OPENAI_API_KEY is not set. ' +
          'Add it as a secret in the consumer repo (Settings → Secrets → Actions → OPENAI_API_KEY).',
      );
    }

    const prompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

    console.log(`[codex-cli] Running Codex (model=${this.model}) via stdin (${prompt.length} chars)`);

    const result = spawnSync(
      'codex',
      ['exec', '--model', this.model, '--full-auto', '-'],
      {
        input: prompt,
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env },
        timeout: CODEX_TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    if (result.error) {
      throw new Error(`Codex CLI failed to start: ${result.error.message}`);
    }
    if (result.status !== 0) {
      console.error('[codex-cli] stderr:', result.stderr);
      throw new Error(`Codex CLI exited with code ${result.status}`);
    }

    const stdout = result.stdout ?? '';
    console.log(`[codex-cli] Finished (${stdout.length} chars stdout)`);

    return stdout;
  }
}

/**
 * Returns the LLM provider for spec-kit steps in the fix workflow.
 */
export function createSpecProvider(): LlmProvider {
  const model = getEffectiveModel(tryLoadConfig());
  const legacy = process.env['DEVELOPER_AGENT_PROVIDER']?.trim();
  if (legacy && legacy !== 'codex-cli') {
    throw new Error(
      `DEVELOPER_AGENT_PROVIDER="${legacy}" is no longer supported. Remove it or set DEVELOPER_AGENT_PROVIDER=codex-cli.`,
    );
  }
  console.log(`[provider] codex-cli (${model})`);
  return new CodexCliProvider(model);
}

/** Same as `createSpecProvider()` (implement step reuses the same CLI). */
export function createImplementProvider(): LlmProvider {
  return createSpecProvider();
}
