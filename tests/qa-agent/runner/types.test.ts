import assert from "node:assert/strict";
import test from "node:test";
import { resolveUrl } from "../../../dist/qa-agent/runner/types";

test("resolveUrl keeps subdirectory base for root paths", () => {
  assert.equal(
    resolveUrl("http://127.0.0.1:4173/SDLCAgents/", "/"),
    "http://127.0.0.1:4173/SDLCAgents/",
  );
  assert.equal(
    resolveUrl("http://127.0.0.1:4173/SDLCAgents", "/health"),
    "http://127.0.0.1:4173/SDLCAgents/health",
  );
  assert.equal(
    resolveUrl("http://127.0.0.1:4173/SDLCAgents/", "https://example.test/x"),
    "https://example.test/x",
  );
});
