import fs from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import { loadPrContext } from "./ingest/prContext";

export async function prepare(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const prContextFile = core.getInput("pr-context-file", { required: true });

  const pr = await loadPrContext(token);

  fs.mkdirSync(path.dirname(prContextFile), { recursive: true });
  fs.writeFileSync(prContextFile, JSON.stringify(pr, null, 2), "utf8");

  core.setOutput("pr-context-file", prContextFile);
  core.info(`Wrote PR context to ${prContextFile}`);
}
