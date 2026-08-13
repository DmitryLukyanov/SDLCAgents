import * as core from "@actions/core";
import { formatTestcaseComment } from "./report/formatComment";
import { postPrComment } from "./report/prComment";
import { parseClaudeOutputFile } from "./validate";
import { validateTestcase } from "./schemas/validateTestcase";

export async function publish(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const mode = core.getInput("mode", { required: true });
  const claudeOutputFile = core.getInput("claude-output-file", {
    required: true,
  });

  if (mode !== "plan-only") {
    throw new Error(`Unsupported mode for publish: ${mode}`);
  }

  const parsed = parseClaudeOutputFile(claudeOutputFile);
  if (!parsed.ok) {
    throw new Error(parsed.errors);
  }

  const result = validateTestcase(parsed.data);
  if (!result.ok) {
    throw new Error(result.errors);
  }

  const body = formatTestcaseComment(parsed.data);
  await postPrComment(token, body);
  core.info("Posted plan-only testcase comment");
}
