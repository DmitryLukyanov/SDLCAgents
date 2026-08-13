import fs from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import { buildTestcasePrompt, loadPromptTemplate, type PromptPrContext } from "./prompts";
import { runClaude } from "./runClaude";

async function run(): Promise<void> {
  const prContextFile = core.getInput("pr-context-file", { required: true });
  const inputFile = core.getInput("input-file", { required: true });
  const outputFile = core.getInput("output-file", { required: true });
  const apiKey = core.getInput("anthropic-api-key", { required: true });

  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const schemaPath = path.join(workspace, "schemas", "testcase.schema.json");
  const templatePath = path.join(
    workspace,
    "prompts",
    "testcase-generation.txt",
  );
  const schemaJson = fs.readFileSync(schemaPath, "utf8");
  const template = loadPromptTemplate(templatePath);

  const pr = JSON.parse(
    fs.readFileSync(prContextFile, "utf8"),
  ) as PromptPrContext;

  const prompt = buildTestcasePrompt(template, pr, schemaJson);

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
