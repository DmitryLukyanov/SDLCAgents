import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildTestcasePrompt,
  loadPromptTemplate,
} from "../dist/claude-cli/prompts";

test("buildTestcasePrompt fills template with schema and PR details", () => {
  const schemaJson = fs.readFileSync(
    path.join(__dirname, "..", "schemas", "testcase.schema.json"),
    "utf8",
  );
  const template = loadPromptTemplate(
    path.join(__dirname, "..", "prompts", "testcase-generation.txt"),
  );

  const prompt = buildTestcasePrompt(
    template,
    {
      number: 7,
      title: "Fix login",
      body: "Users cannot log in.",
      changedFiles: [
        {
          filename: "login.ts",
          status: "modified",
          patch: "@@\n-return false;\n+return true;",
        },
      ],
    },
    schemaJson,
  );

  assert.match(prompt, /JSON Schema/);
  assert.match(prompt, /"cases"/);
  assert.match(prompt, /PR #7: Fix login/);
  assert.match(prompt, /Users cannot log in/);
  assert.match(prompt, /modified: login\.ts/);
  assert.match(prompt, /return true/);
  assert.match(prompt, /JSON only/);
  assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/);
});
