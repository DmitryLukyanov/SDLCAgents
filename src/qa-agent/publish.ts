import fs from "node:fs";
import * as core from "@actions/core";
import { hasFailedP0 } from "./run";
import {
  formatTestcaseComment,
  type CommentRunResult,
} from "./report/formatComment";
import { postPrComment } from "./report/prComment";
import { validateTestcase } from "./schemas/validateTestcase";
import { parseClaudeOutputFile } from "./validate";

export async function publish(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const mode = core.getInput("mode", { required: true });
  const claudeOutputFile = core.getInput("claude-output-file", {
    required: true,
  });

  if (mode !== "plan-only" && mode !== "plan-and-run") {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const parsed = parseClaudeOutputFile(claudeOutputFile);
  if (!parsed.ok) {
    throw new Error(parsed.errors);
  }

  const result = validateTestcase(parsed.data);
  if (!result.ok) {
    throw new Error(result.errors);
  }

  let runResults: CommentRunResult[] = [];
  if (mode === "plan-and-run") {
    const resultsFile = core.getInput("results-file", { required: true });
    const parsedResults = JSON.parse(fs.readFileSync(resultsFile, "utf8")) as {
      results: CommentRunResult[];
    };
    runResults = parsedResults.results;
  }

  const body = formatTestcaseComment(parsed.data, mode, runResults);
  await postPrComment(token, body);
  core.info(`Posted ${mode} testcase comment`);

  if (mode === "plan-and-run" && hasFailedP0(runResults)) {
    core.setFailed("One or more P0 testcases failed");
  }
}
