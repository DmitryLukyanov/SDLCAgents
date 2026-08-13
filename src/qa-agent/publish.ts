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
  const claudeOutputFile = core.getInput("claude-output-file", {
    required: true,
  });
  const resultsFile = core.getInput("results-file", { required: true });

  const parsed = parseClaudeOutputFile(claudeOutputFile);
  if (!parsed.ok) {
    throw new Error(parsed.errors);
  }

  const result = validateTestcase(parsed.data);
  if (!result.ok) {
    throw new Error(result.errors);
  }

  const parsedResults = JSON.parse(fs.readFileSync(resultsFile, "utf8")) as {
    results: CommentRunResult[];
  };
  const runResults = parsedResults.results;

  const body = formatTestcaseComment(parsed.data, runResults);
  await postPrComment(token, body);
  core.info("Posted testcase comment");

  if (hasFailedP0(runResults)) {
    core.setFailed("One or more P0 testcases failed");
  }
}
