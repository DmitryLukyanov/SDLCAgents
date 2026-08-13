import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSummaryTable,
  formatTestcaseComment,
} from "../dist/qa-agent/report/formatComment";

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

test("formatTestcaseComment lists run results", () => {
  const body = formatTestcaseComment(cases, [
    { id: "ui-1", ok: false, skipped: false, error: "expected Welcome" },
    { id: "ui-2", ok: true, skipped: true },
  ]);

  assert.match(body, /qa-agent-report/);
  assert.match(body, /\*\*ui-1\*\* \(P0, ui\): Home loads — FAIL: expected Welcome/);
  assert.match(body, /\*\*ui-2\*\* \(P1, ui\): Extra check — skipped/);
});

test("formatSummaryTable lists planned cases and results", () => {
  const summary = formatSummaryTable(cases, [
    { id: "ui-1", ok: false, skipped: false, error: "expected Welcome" },
    { id: "ui-2", ok: true, skipped: true },
  ]);

  assert.match(summary, /\| ID \| Priority \| Type \| Title \| Result \|/);
  assert.match(summary, /\| ui-1 \| P0 \| ui \| Home loads \| FAIL: expected Welcome \|/);
  assert.match(summary, /\| ui-2 \| P1 \| ui \| Extra check \| skipped \|/);
});
