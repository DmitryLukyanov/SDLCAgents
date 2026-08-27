import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hasFailedCase, runP0Cases } from "../dist/qa-agent/run";
import type { ApiCase } from "../dist/qa-agent/runner/types";

function startHealthServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("failed to bind health server"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => {
              if (error) {
                fail(error);
                return;
              }
              done();
            });
          }),
      });
    });
  });
}

test("runP0Cases runs all priorities", async () => {
  const server = await startHealthServer();
  try {
    const passing: ApiCase = {
      id: "api-health",
      title: "Health endpoint returns 200",
      priority: "P0",
      type: "api",
      request: { method: "GET", path: "/health" },
      asserts: { status: 200, bodyContains: "ok" },
    };
    const p1: ApiCase = {
      id: "api-later",
      title: "Later check",
      priority: "P1",
      type: "api",
      request: { method: "GET", path: "/health" },
      asserts: { status: 200, bodyContains: "ok" },
    };
    const failing: ApiCase = {
      id: "api-wrong",
      title: "Health expected 201",
      priority: "P0",
      type: "api",
      request: { method: "GET", path: "/health" },
      asserts: { status: 201 },
    };

    const results = await runP0Cases([passing, p1, failing], {
      baseUrl: server.baseUrl,
      timeoutMs: 5_000,
      screenshotDir: path.join(os.tmpdir(), "qa-agent-run-p0"),
    });

    assert.equal(results[0]?.ok, true);
    assert.equal(results[1]?.ok, true);
    assert.equal(results[2]?.ok, false);
    assert.equal(hasFailedCase(results), true);
  } finally {
    await server.close();
  }
});
