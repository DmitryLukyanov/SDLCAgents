import assert from "node:assert/strict";
import test from "node:test";
import { formatTestcaseComment } from "../dist/qa-agent/report/formatComment";

test("formatTestcaseComment lists cases", () => {
  const body = formatTestcaseComment({
    cases: [
      {
        id: "ui-1",
        title: "Home loads",
        priority: "P0",
        type: "ui",
      },
    ],
  });

  assert.match(body, /qa-agent-report/);
  assert.match(body, /plan-only/);
  assert.match(body, /\*\*ui-1\*\* \(P0, ui\): Home loads/);
});
