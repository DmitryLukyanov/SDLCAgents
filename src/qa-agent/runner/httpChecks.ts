import { resolveUrl, type ApiCase, type RunResult } from "./types";

export async function runHttpCheck(
  testCase: ApiCase,
  options: { baseUrl: string; timeoutMs: number },
): Promise<RunResult> {
  const url = resolveUrl(options.baseUrl, testCase.request.path);
  const init: RequestInit = {
    method: testCase.request.method,
    signal: AbortSignal.timeout(options.timeoutMs),
  };

  if (testCase.request.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(testCase.request.body);
  }

  try {
    const response = await fetch(url, init);
    const body = await response.text();

    if (response.status !== testCase.asserts.status) {
      return {
        ok: false,
        error: `expected status ${testCase.asserts.status}, got ${response.status}`,
      };
    }

    if (
      testCase.asserts.bodyContains !== undefined &&
      !body.includes(testCase.asserts.bodyContains)
    ) {
      return {
        ok: false,
        error: `response body does not contain "${testCase.asserts.bodyContains}"`,
      };
    }

    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
