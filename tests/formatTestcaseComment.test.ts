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
      steps: [
        { action: "goto", url: "/" },
        { action: "expectText", text: "Welcome", selector: "h1" },
      ],
    },
    {
      id: "ui-2",
      title: "Extra check",
      priority: "P1",
      type: "ui",
      steps: [{ action: "goto", url: "/" }],
    },
  ],
};

test("formatTestcaseComment lists run results", () => {
  const body = formatTestcaseComment(cases, [
    { id: "ui-1", ok: false, error: "expected Welcome" },
    { id: "ui-2", ok: true },
  ]);

  assert.match(body, /qa-agent-report/);
  assert.match(body, /\*\*ui-1\*\* \(P0, ui\): Home loads — FAIL: expected Welcome/);
  assert.match(body, /\*\*ui-2\*\* \(P1, ui\): Extra check — PASS/);
});

test("buildSummaryTableRows includes steps and before/after screenshots", () => {
  const rows = buildSummaryTableRows(
    cases,
    [
      {
        id: "ui-1",
        ok: false,
        error: "expected Welcome",
        screenshotBefore: "claude-work/screenshots/ui-1-before.png",
        screenshotAfter: "claude-work/screenshots/ui-1-after.png",
      },
      { id: "ui-2", ok: true },
    ],
    "https://example.test/shots",
  );

  assert.deepEqual(
    rows[0].map((cell) => cell.data),
    ["ID", "Priority", "Type", "Title", "Steps", "Result", "Before", "After"],
  );
  assert.equal(rows[1][0].data, "ui-1");
  assert.match(rows[1][4].data, /1\. goto \//);
  assert.match(rows[1][4].data, /2\. expectText &quot;Welcome&quot; in h1/);
  assert.equal(rows[1][5].data, "FAIL: expected Welcome");
  assert.match(
    rows[1][6].data,
    /<img src="https:\/\/example\.test\/shots\/ui-1-before\.png"/,
  );
  assert.match(
    rows[1][7].data,
    /<img src="https:\/\/example\.test\/shots\/ui-1-after\.png"/,
  );
  assert.equal(rows[2][5].data, "PASS");
  assert.equal(rows[2][6].data, "—");
  assert.equal(rows[2][7].data, "—");
});
