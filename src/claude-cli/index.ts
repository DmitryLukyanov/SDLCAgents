import fs from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import {
  buildAddPrompt,
  buildRepairPrompt,
  buildTestcasePrompt,
  loadPromptTemplate,
  type PromptPrContext,
} from "./prompts";
import { runClaude } from "./runClaude";

async function run(): Promise<void> {
  const prContextFile = core.getInput("pr-context-file", { required: true });
  const inputFile = core.getInput("input-file", { required: true });
  const outputFile = core.getInput("output-file", { required: true });
  const apiKey = core.getInput("anthropic-api-key", { required: true });
  const validationErrors = core.getInput("validation-errors");
  const humanComment = core.getInput("human-comment");

  const repoRoot = path.join(__dirname, "..", "..");
  const promptsDir = path.join(repoRoot, "src", "claude-cli", "prompts");
  const schemaPath = path.join(repoRoot, "schemas", "testcase.schema.json");
  const schemaJson = fs.readFileSync(schemaPath, "utf8");

  const pr = JSON.parse(
    fs.readFileSync(prContextFile, "utf8"),
  ) as PromptPrContext;

  let prompt: string;
  if (humanComment.length > 0) {
    const template = loadPromptTemplate(
      path.join(promptsDir, "testcase-add.txt"),
    );
    const previousJson = fs.readFileSync(outputFile, "utf8");
    prompt = buildAddPrompt(
      template,
      pr,
      schemaJson,
      humanComment,
      previousJson,
    );
  } else if (validationErrors.length > 0) {
    const template = loadPromptTemplate(
      path.join(promptsDir, "testcase-repair.txt"),
    );
    const previousJson = fs.readFileSync(outputFile, "utf8");
    prompt = buildRepairPrompt(
      template,
      pr,
      schemaJson,
      validationErrors,
      previousJson,
    );
  } else {
    const template = loadPromptTemplate(
      path.join(promptsDir, "testcase-generation.txt"),
    );
    prompt = buildTestcasePrompt(template, pr, schemaJson);
  }

  fs.mkdirSync(path.dirname(inputFile), { recursive: true });
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(inputFile, prompt, "utf8");

  core.info("Running Claude CLI for testcase generation");
  const { resultText } = await runClaude({ prompt, apiKey });
  fs.writeFileSync(outputFile, resultText, "utf8");

  core.setOutput("input-file", inputFile);
  core.setOutput("output-file", outputFile);
  core.info("Claude CLI finished; input and output files written");
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
