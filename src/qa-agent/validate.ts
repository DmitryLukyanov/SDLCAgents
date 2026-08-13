import fs from "node:fs";
import * as core from "@actions/core";
import { validateTestcase } from "./schemas/validateTestcase";

export type ParsedClaudeOutput =
  | { ok: true; data: unknown }
  | { ok: false; errors: string };

export function parseClaudeOutputFile(filePath: string): ParsedClaudeOutput {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: `Invalid JSON: ${message}` };
  }
}

export function validate(): void {
  const claudeOutputFile = core.getInput("claude-output-file", {
    required: true,
  });

  const parsed = parseClaudeOutputFile(claudeOutputFile);
  if (!parsed.ok) {
    core.setOutput("valid", "false");
    core.setOutput("errors", parsed.errors);
    core.info("Claude output is not valid JSON");
    return;
  }

  const result = validateTestcase(parsed.data);
  if (!result.ok) {
    core.setOutput("valid", "false");
    core.setOutput("errors", result.errors);
    core.info("Claude output failed schema validation");
    return;
  }

  core.setOutput("valid", "true");
  core.setOutput("errors", "");
  core.info("Claude output passed schema validation");
}
