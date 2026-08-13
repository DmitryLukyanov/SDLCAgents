import fs from "node:fs";
import * as core from "@actions/core";
import { hasFailedP0 } from "./run";
import {
  formatSummaryTable,
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

  const summary = core.summary.addRaw(
    formatSummaryTable(parsed.data, runResults),
    true,
  );

  const screenshotResults = runResults.filter((runResult) => {
    return (
      typeof runResult.screenshot === "string" &&
      fs.existsSync(runResult.screenshot)
    );
  });
  if (screenshotResults.length > 0) {
    summary.addHeading("Screenshots", 2);
    for (const runResult of screenshotResults) {
      const screenshotPath = runResult.screenshot;
      if (!screenshotPath) {
        continue;
      }
      const png = fs.readFileSync(screenshotPath);
      summary.addHeading(runResult.id, 3);
      summary.addImage(
        `data:image/png;base64,${png.toString("base64")}`,
        runResult.id,
      );
    }
  }

  await summary.write();
  core.info("Wrote job summary");

  if (hasFailedP0(runResults)) {
    core.setFailed("One or more P0 testcases failed");
  }
}
