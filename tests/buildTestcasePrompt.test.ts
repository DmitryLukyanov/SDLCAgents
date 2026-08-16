import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildAddPrompt,
  buildRepairPrompt,
  buildTestcasePrompt,
  loadPromptTemplate,
} from "../dist/claude-cli/prompts";

const pr = {
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
};

test("buildTestcasePrompt fills generation template", () => {
  const schemaJson = fs.readFileSync(
    path.join(__dirname, "..", "schemas", "testcase.schema.json"),
    "utf8",
  );
  const template = loadPromptTemplate(
    path.join(__dirname, "..", "prompts", "testcase-generation.txt"),
  );

  const prompt = buildTestcasePrompt(template, pr, schemaJson);

  assert.match(prompt, /JSON Schema/);
  assert.match(prompt, /"cases"/);
  assert.match(prompt, /PR #7: Fix login/);
  assert.match(prompt, /Users cannot log in/);
  assert.match(prompt, /modified: login\.ts/);
  assert.match(prompt, /return true/);
  assert.match(prompt, /JSON only/);
  assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/);
});

test("buildRepairPrompt fills repair template", () => {
  const schemaJson = fs.readFileSync(
    path.join(__dirname, "..", "schemas", "testcase.schema.json"),
    "utf8",
  );
  const template = loadPromptTemplate(
    path.join(__dirname, "..", "prompts", "testcase-repair.txt"),
  );

  const prompt = buildRepairPrompt(
    template,
    pr,
    schemaJson,
    "/cases/0/priority must be equal to one of the allowed values",
    '{"cases":[]}',
  );

  assert.match(prompt, /Validation errors/);
  assert.match(prompt, /allowed values/);
  assert.match(prompt, /\{"cases":\[\]\}/);
  assert.match(prompt, /PR #7: Fix login/);
  assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/);
});

test("buildAddPrompt fills add template", () => {
  const schemaJson = fs.readFileSync(
    path.join(__dirname, "..", "schemas", "testcase.schema.json"),
    "utf8",
  );
  const template = loadPromptTemplate(
    path.join(__dirname, "..", "prompts", "testcase-add.txt"),
  );

  const prompt = buildAddPrompt(
    template,
    pr,
    schemaJson,
    "@claude add sin(270) is -1",
    '{"cases":[]}',
  );

  assert.match(prompt, /Human comment/);
  assert.match(prompt, /sin\(270\) is -1/);
  assert.match(prompt, /\{"cases":\[\]\}/);
  assert.match(prompt, /PR #7: Fix login/);
  assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/);
});
