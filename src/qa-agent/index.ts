import * as core from "@actions/core";
import { loadPrContext } from "./ingest/prContext";
import { postPrComment } from "./report/prComment";

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const pr = await loadPrContext(token);

  const body = [
    "<!-- qa-agent-mock -->",
    `QA Agent mock comment for PR #${pr.number}`,
    "",
    `Title: ${pr.title}`,
    `Changed files: ${pr.changedFiles.length}`,
    ...pr.changedFiles.map((file) => `- ${file.status}: ${file.filename}`),
  ].join("\n");

  await postPrComment(token, body);
  core.info(`Posted mock comment for PR #${pr.number}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
