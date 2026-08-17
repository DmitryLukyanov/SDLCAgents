import fs from "node:fs";
import * as core from "@actions/core";
import { hasFailedCase } from "./run";
import {
  buildSummaryTableRows,
  formatTestcaseComment,
  type CommentRunResult,
} from "./report/formatComment";
import { postPrComment } from "./report/prComment";
import { ensureValidTestcase } from "./schemas/ensureValidTestcase";
import { parseClaudeOutputFile } from "./validate";

function screenshotBaseUrl(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) {
    throw new Error("GITHUB_REPOSITORY and GITHUB_RUN_ID are required");
  }
  return `https://github.com/${repo}/blob/qa-screenshots/${runId}`;
}

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

  const result = ensureValidTestcase(parsed.data);
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

  await core.summary
    .addHeading("QA Agent — testcases", 2)
    .addTable(buildSummaryTableRows(parsed.data, runResults, screenshotBaseUrl()))
    .write();
  core.info("Wrote job summary");

  if (hasFailedCase(runResults)) {
    core.setFailed("One or more testcases failed");
  }
}
