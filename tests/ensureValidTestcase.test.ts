import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ensureValidTestcase } from "../dist/qa-agent/schemas/ensureValidTestcase";

const fixturesDir = path.join(__dirname, "..", "tests", "fixtures");

function readFixture(name: string): unknown {
  const raw = fs.readFileSync(path.join(fixturesDir, name), "utf8");
  return JSON.parse(raw) as unknown;
}

test("valid fixture passes", () => {
  const data = readFixture("testcase.valid.json");
  const result = ensureValidTestcase(data);
  assert.equal(result.ok, true);
});

test("invalid fixture fails", () => {
  const data = readFixture("testcase.invalid.json");
  const result = ensureValidTestcase(data);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.length > 0);
  }
});
