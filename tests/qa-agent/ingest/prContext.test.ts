import assert from "node:assert/strict";
import test from "node:test";
import { resolvePullNumber } from "../../../dist/qa-agent/ingest/prContext";

test("resolvePullNumber reads pull_request events", () => {
  assert.equal(resolvePullNumber({ pull_request: { number: 101 } }), 101);
});

test("resolvePullNumber reads PR issue comments", () => {
  assert.equal(
    resolvePullNumber({ issue: { number: 101, pull_request: {} } }),
    101,
  );
});

test("resolvePullNumber rejects non-PR payloads", () => {
  assert.throws(() => resolvePullNumber({ issue: { number: 9 } }), /Not a pull request/);
});
