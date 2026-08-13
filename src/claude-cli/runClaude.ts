import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ClaudeRunResult = {
  resultText: string;
};

export async function runClaude(options: {
  prompt: string;
  apiKey: string;
}): Promise<ClaudeRunResult> {
  const { stdout } = await execFileAsync(
    "claude",
    ["-p", "--output-format", "json", "--tools", "", options.prompt],
    {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: options.apiKey,
      },
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    },
  );

  const parsed = JSON.parse(stdout) as { result?: unknown };
  if (typeof parsed.result !== "string") {
    throw new Error("Claude CLI JSON missing string result field");
  }

  return { resultText: parsed.result };
}
