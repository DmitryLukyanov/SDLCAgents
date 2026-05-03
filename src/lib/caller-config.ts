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
   * When set, the **parent** entry workflow should treat this as a resume after an async segment:
   * skip pipeline steps through this step id (inclusive), then continue (see `pipeline-expected-step-helper.getPipelineStartIndex`).
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

/** True when `caller_config` requests the parent resume path (after an async child). */
export function isPipelineResumeCallerConfig(root: CallerConfigRoot): boolean {
  return Boolean(root.params?.async_trigger_step?.trim());
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
