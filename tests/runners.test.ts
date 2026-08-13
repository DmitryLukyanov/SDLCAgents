import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runHttpCheck } from "../dist/qa-agent/runner/httpChecks";
import { runPlaywrightCase } from "../dist/qa-agent/runner/playwright";
import type { ApiCase, UiCase } from "../dist/qa-agent/runner/types";

const timeoutMs = 10_000;

function startFixtureServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        "<!doctype html><html><body><h1>Welcome</h1><a id=\"next\" href=\"/next\">Next</a><input id=\"name\"></body></html>",
      );
      return;
    }

    if (req.url === "/next") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><html><body><h1>Done</h1></body></html>");
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("failed to bind fixture server"));
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

test("HTTP check passes and fails predictably", async () => {
  const server = await startFixtureServer();
  try {
    const passing: ApiCase = {
      id: "api-health",
      title: "Health endpoint returns 200",
      priority: "P0",
      type: "api",
      request: { method: "GET", path: "/health" },
      asserts: { status: 200, bodyContains: "ok" },
    };
    const failing: ApiCase = {
      id: "api-health-wrong-status",
      title: "Health endpoint expected 201",
      priority: "P0",
      type: "api",
      request: { method: "GET", path: "/health" },
      asserts: { status: 201 },
    };

    const pass = await runHttpCheck(passing, {
      baseUrl: server.baseUrl,
      timeoutMs,
    });
    const fail = await runHttpCheck(failing, {
      baseUrl: server.baseUrl,
      timeoutMs,
    });

    assert.equal(pass.ok, true);
    assert.equal(fail.ok, false);
    if (!fail.ok) {
      assert.match(fail.error, /expected status 201/);
    }
  } finally {
    await server.close();
  }
});

test("Playwright UI case passes and fails predictably", async () => {
  const server = await startFixtureServer();
  const screenshotDir = path.join(os.tmpdir(), "qa-agent-runner-tests");
  try {
    const passing: UiCase = {
      id: "ui-home-loads",
      title: "Home page shows welcome text",
      priority: "P0",
      type: "ui",
      steps: [
        { action: "goto", url: "/" },
        { action: "expectText", text: "Welcome" },
      ],
    };
    const failing: UiCase = {
      id: "ui-home-missing-text",
      title: "Home page shows missing text",
      priority: "P0",
      type: "ui",
      steps: [
        { action: "goto", url: "/" },
        { action: "expectText", text: "NotThere" },
      ],
    };

    const passScreenshot = path.join(screenshotDir, "pass.png");
    const failScreenshot = path.join(screenshotDir, "fail.png");

    const pass = await runPlaywrightCase(passing, {
      baseUrl: server.baseUrl,
      timeoutMs,
      screenshotPath: passScreenshot,
    });
    const fail = await runPlaywrightCase(failing, {
      baseUrl: server.baseUrl,
      timeoutMs,
      screenshotPath: failScreenshot,
    });

    assert.equal(pass.ok, true);
    assert.equal(fail.ok, false);
    assert.ok(fs.existsSync(passScreenshot));
    assert.ok(fs.existsSync(failScreenshot));
  } finally {
    await server.close();
  }
});
