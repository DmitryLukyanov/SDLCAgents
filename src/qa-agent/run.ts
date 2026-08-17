import fs from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import { runHttpCheck } from "./runner/httpChecks";
import { runPlaywrightCase } from "./runner/playwright";
import type { ApiCase, UiCase } from "./runner/types";
import { ensureValidTestcase } from "./schemas/ensureValidTestcase";
import { parseClaudeOutputFile } from "./validate";

const CASE_TIMEOUT_MS = 30_000;

export type CaseRunResult = {
  id: string;
  ok: boolean;
  error?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
};

export async function runP0Cases(
  cases: Array<UiCase | ApiCase>,
  options: { baseUrl: string; timeoutMs: number; screenshotDir: string },
): Promise<CaseRunResult[]> {
  const results: CaseRunResult[] = [];

  for (const testCase of cases) {
    if (testCase.type === "ui") {
      const screenshotBeforePath = path.join(
        options.screenshotDir,
        `${testCase.id}-before.png`,
      );
      const screenshotAfterPath = path.join(
        options.screenshotDir,
        `${testCase.id}-after.png`,
      );
      const result = await runPlaywrightCase(testCase, {
        baseUrl: options.baseUrl,
        timeoutMs: options.timeoutMs,
        screenshotBeforePath,
        screenshotAfterPath,
      });
      results.push({
        id: testCase.id,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
        screenshotBefore: result.screenshotBefore,
        screenshotAfter: result.screenshotAfter,
      });
      continue;
    }

    const result = await runHttpCheck(testCase, {
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
    });
    results.push({
      id: testCase.id,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    });
  }

  return results;
}

export function hasFailedCase(results: Array<{ ok: boolean }>): boolean {
  return results.some((result) => !result.ok);
}

export async function runP0(): Promise<void> {
  const claudeOutputFile = core.getInput("claude-output-file", {
    required: true,
  });
  const resultsFile = core.getInput("results-file", { required: true });
  const screenshotDir = core.getInput("screenshot-dir", { required: true });
  const logFile = core.getInput("log-file", { required: true });
  const baseUrl = core.getInput("base-url", { required: true });

  const parsed = parseClaudeOutputFile(claudeOutputFile);
  if (!parsed.ok) {
    throw new Error(parsed.errors);
  }

  const valid = ensureValidTestcase(parsed.data);
  if (!valid.ok) {
    throw new Error(valid.errors);
  }

  const data = parsed.data as { cases: Array<UiCase | ApiCase> };
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const results = await runP0Cases(data.cases, {
    baseUrl,
    timeoutMs: CASE_TIMEOUT_MS,
    screenshotDir,
  });

  const logLines = results.map((result) => {
    if (result.ok) {
      return `${result.id}: pass`;
    }
    return `${result.id}: fail ${result.error ?? ""}`;
  });

  fs.writeFileSync(resultsFile, JSON.stringify({ results }, null, 2), "utf8");
  fs.writeFileSync(logFile, `${logLines.join("\n")}\n`, "utf8");

  core.setOutput("results-file", resultsFile);
  core.setOutput("log-file", logFile);
  core.info(`Wrote run results to ${resultsFile}`);
}
