/**
 * Async invocation helpers.
 *
 * Used to design async "prepare" steps that hand off work to a separate job
 * (e.g. a reusable workflow job calling an LLM) and later resume without
 * callbacks. This module is intentionally agent-agnostic.
 */

export type AsyncInvocationDecision<TState extends Record<string, unknown>> =
  | { kind: 'continue' }
  | { kind: 'handoff'; state: TState };

/**
 * Wrap a prepare function so it can run in both modes:
 *
 * - Initial invocation: runs `prepare()`, persists the returned state (if any),
 *   and tells the caller whether to hand off.
 * - Resume invocation: skips prepare and just returns `continue`.
 */
export async function runAsyncPrepareNoCallback<TState extends Record<string, unknown>>(
  params: {
    isResume: boolean;
    prepare: () => Promise<TState | void>;
    persistState: (state: TState) => Promise<void> | void;
  },
): Promise<AsyncInvocationDecision<TState>> {
  if (params.isResume) {
    return { kind: 'continue' };
  }

  const state = await params.prepare();
  if (!state) {
    return { kind: 'continue' };
  }

  await params.persistState(state);
  return { kind: 'handoff', state };
}

