/**
 * Caller-supplied run context: URL-encoded JSON `{ params: { … } }`.
 * Workflow input `caller_config` / env `CALLER_CONFIG` — built by callers (e.g. `routing_helper.ts`) or passed on manual dispatch.
 *
 * Async pipeline handoff (any agent): parent sets `callback` + `async_trigger_step` + parent run ids when dispatching a child;
 * child adds `async_child_run_id` when dispatching the parent again so the parent can load cross-run artifacts.
 */

export interface CallerConfigParams {
  inputJql?: string;
  customParams?: Record<string, string | undefined>;
  /**
   * Stable id of the pipeline step that owns the async handoff (`id` on that step).
   * - With **`async_child_run_id`**: parent resume — full step loop replays from index 0; steps before this id are skipped from checkpoint; this step is completed from handoff artifacts (see AI Teammate `runPipelineFromConfigForCi`).
   * - **Without** `async_child_run_id`: optional mid-entry only — first executed step index is after this id (`getPipelineStartIndexFromCallerRoot`).
   */
  async_trigger_step?: string;
  /** Parent workflow filename to `workflow_dispatch` after async work (e.g. `ai-teammate.yml`). */
  callback?: string;
  /** Parent run URL for traceability (comments, logs). */
  parent_run_url?: string;
  /** Parent `github.run_id` — e.g. download artifacts produced before the async dispatch. */
  parent_run_id?: string;
  /** Async child `github.run_id` — e.g. download artifacts produced in the child workflow on parent resume. */
  async_child_run_id?: string;
}

export interface CallerConfigRoot {
  params?: CallerConfigParams;
}

/** Decode `CALLER_CONFIG` (workflow input `caller_config`) after `decodeURIComponent` + `JSON.parse`. */
export function decodeCallerConfig(callerConfigEncoded: string): CallerConfigRoot {
  const raw = decodeURIComponent(callerConfigEncoded.trim());
  const parsed = JSON.parse(raw) as CallerConfigRoot;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('caller_config: invalid JSON root');
  }
  return parsed;
}

/** Parses `key = PROJ-123` / `key=PROJ-123` from `params.inputJql`. */
export function extractIssueKeyFromCallerConfig(root: CallerConfigRoot): string {
  const jql = root.params?.inputJql?.trim();
  if (!jql) throw new Error('caller_config.params.inputJql is required');

  const m = jql.match(/key\s*=\s*([A-Za-z0-9]+-\d+)/i);
  if (!m?.[1]) {
    throw new Error(`caller_config: could not parse issue key from inputJql: ${jql}`);
  }
  return m[1].toUpperCase();
}

/**
 * True when the parent is resuming after an async child completed (`async_child_run_id` set on callback).
 * Use with {@link requireAsyncResumeTriggerStepId} to locate the skipped async step in `params.steps`.
 */
export function isParentAsyncChildResumeCallerConfig(root: CallerConfigRoot): boolean {
  return Boolean(root.params?.async_child_run_id?.toString().trim());
}

/** Require `caller_config.params.async_trigger_step` when resuming after an async child (inclusive skip boundary). */
export function requireAsyncResumeTriggerStepId(root: CallerConfigRoot): string {
  const id = root.params?.async_trigger_step?.toString().trim() ?? '';
  if (!id) {
    throw new Error(
      'caller_config.params.async_trigger_step is required when async_child_run_id is set (parent resume after async child).',
    );
  }
  return id;
}

/** URL-encode JSON for workflow `caller_config` / env `CALLER_CONFIG`. */
export function encodeCallerConfig(root: CallerConfigRoot): string {
  return encodeURIComponent(JSON.stringify(root));
}

/** Merge fields into `params` and re-encode (for async child dispatch and callback payloads). */
export function mergeCallerConfigEncoded(
  callerConfigEncoded: string,
  patch: Partial<CallerConfigParams>,
): string {
  const root = decodeCallerConfig(callerConfigEncoded);
  const prev = root.params ?? {};
  root.params = { ...prev, ...patch };
  return encodeCallerConfig(root);
}
