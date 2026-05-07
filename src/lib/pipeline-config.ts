/**
 * Shared pipeline JSON shape for agent configs (`params.runner === "pipeline"`).
 *
 * Cross-agent stack (all under `src/lib/`):
 *   • `pipeline-config.ts` — parse/normalize steps, find `async_call`
 *   • `pipeline-expected-step-helper.ts` — resume cursor → start step index
 *   • `pipeline-callback-config.ts` — merge `caller_config` for child dispatch / parent callback
 *   • `caller-config.ts` — encode/decode/merge generic `params`
 *   • `agent-skip-if-label.ts` — read agent config file → `params.skipIfLabel` → `getIssueLabelNames` → skip reason
 *   • `jira/jira-client.ts` — `getIssueLabelNames` (shared label read for agents)
 *   • `routing_helper.ts` — GitHub dispatch payload shape (no Octokit)
 *   • `agent-invocation-contract.ts` — optional `contract` on async steps (artifact bindings)
 *   • `invocation-handoff.ts` — composed manifest/config/input checks (reusable across CI entrypoints)
 *   • `dispatch-parent-callback-workflow-ci.ts` — CI: merge resume fields + `dispatchGithubWorkflow(octokit, …)`
 */

export interface PipelineAsyncCallSpec {
  workflowFile: string;
  workflowRef?: string;
  /** When true, dispatch child workflow without configuring callback/resume. */
  terminal?: boolean;
  /** Extra string-only workflow_dispatch inputs merged after system fields. */
  inputs?: Record<string, string>;
}

export interface PipelineStepConfig {
  /** Stable id for resume / async_trigger_step (defaults to `${runner}#${index}` if omitted). */
  id?: string;
  runner: string;
  enabled?: boolean;
  async_call?: PipelineAsyncCallSpec;
  [key: string]: unknown;
}

export interface AgentPipelineParams {
  runner?: string;
  steps?: PipelineStepConfig[];
  [key: string]: unknown;
}

export interface AgentJsonWithPipeline {
  params?: AgentPipelineParams;
  [key: string]: unknown;
}

export function normalizePipelineStepIds(steps: PipelineStepConfig[]): PipelineStepConfig[] {
  return steps.map((s, index) => {
    const id = (typeof s.id === 'string' && s.id.trim()) ? s.id.trim() : `${s.runner}#${index}`;
    return { ...s, id };
  });
}

/** FR-023: duplicate normalized ids are invalid. */
export function assertUniqueNormalizedStepIds(steps: PipelineStepConfig[], configLabel: string): void {
  const ids = steps.map((s) => s.id!);
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  if (dups.size > 0) {
    throw new Error(
      `${configLabel}: duplicate step id(s) after normalization: ${[...dups].sort().join(', ')} ` +
        '(set unique steps[].id values)',
    );
  }
}

export function parseAgentPipelineSteps(rawConfigText: string, configLabel: string): PipelineStepConfig[] {
  let root: AgentJsonWithPipeline;
  try {
    root = JSON.parse(rawConfigText) as AgentJsonWithPipeline;
  } catch (e) {
    throw new Error(`${configLabel}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const steps = root.params?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`${configLabel}: params.steps must be a non-empty array when using pipeline routing helpers.`);
  }
  for (const s of steps) {
    if (!s || typeof s !== 'object') throw new Error(`${configLabel}: each step must be an object`);
    if (typeof s.runner !== 'string' || !s.runner.trim()) {
      throw new Error(`${configLabel}: each step requires a non-empty "runner" string`);
    }
    if (s.async_call) {
      const ac = s.async_call;
      if (typeof ac.workflowFile !== 'string' || !ac.workflowFile.trim()) {
        throw new Error(`${configLabel}: async_call.workflowFile is required for step "${s.runner}"`);
      }
    }
  }
  const normalized = normalizePipelineStepIds(steps as PipelineStepConfig[]);
  assertUniqueNormalizedStepIds(normalized, configLabel);
  return normalized;
}

/** First step that declares `async_call`, or -1 if none. */
export function findFirstAsyncCallStepIndex(steps: PipelineStepConfig[]): number {
  return steps.findIndex(s => Boolean(s.async_call));
}

/** First **enabled** step with `async_call` (`enabled: false` skips), or -1. */
export function findFirstEnabledAsyncCallStepIndex(steps: PipelineStepConfig[]): number {
  return steps.findIndex(s => Boolean(s.async_call) && s.enabled !== false);
}
