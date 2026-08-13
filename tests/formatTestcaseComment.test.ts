import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSummaryTableRows,
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

test("buildSummaryTableRows includes screenshot column", () => {
  const rows = buildSummaryTableRows(
    cases,
    [
      {
        id: "ui-1",
        ok: false,
        skipped: false,
        error: "expected Welcome",
        screenshot: "claude-work/screenshots/ui-1.png",
      },
      { id: "ui-2", ok: true, skipped: true },
    ],
    "https://example.test/shots",
  );

  assert.deepEqual(
    rows[0].map((cell) => cell.data),
    ["ID", "Priority", "Type", "Title", "Result", "Screenshot"],
  );
  assert.equal(rows[1][0].data, "ui-1");
  assert.equal(rows[1][4].data, "FAIL: expected Welcome");
  assert.match(
    rows[1][5].data,
    /<img src="https:\/\/example\.test\/shots\/ui-1\.png"/,
  );
  assert.equal(rows[2][4].data, "skipped");
  assert.equal(rows[2][5].data, "—");
});
