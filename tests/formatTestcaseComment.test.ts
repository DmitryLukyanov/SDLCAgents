import assert from "node:assert/strict";
import test from "node:test";
import { formatTestcaseComment } from "../dist/qa-agent/report/formatComment";

const cases = {
  cases: [
    {
      id: "ui-1",
      title: "Home loads",
      priority: "P0",
      type: "ui",
    },
    {
      id: "ui-2",
      title: "Extra check",
      priority: "P1",
      type: "ui",
    },
  ],
};

test("formatTestcaseComment lists cases for plan-only", () => {
  const body = formatTestcaseComment(cases, "plan-only");

  assert.match(body, /qa-agent-report/);
  assert.match(body, /plan-only/);
  assert.match(body, /\*\*ui-1\*\* \(P0, ui\): Home loads$/m);
  assert.doesNotMatch(body, /PASS|FAIL|skipped/);
});

test("formatTestcaseComment lists run results for plan-and-run", () => {
  const body = formatTestcaseComment(cases, "plan-and-run", [
    { id: "ui-1", ok: false, skipped: false, error: "expected Welcome" },
    { id: "ui-2", ok: true, skipped: true },
  ]);

  assert.match(body, /plan-and-run/);
  assert.match(body, /\*\*ui-1\*\* \(P0, ui\): Home loads — FAIL: expected Welcome/);
  assert.match(body, /\*\*ui-2\*\* \(P1, ui\): Extra check — skipped/);
});
