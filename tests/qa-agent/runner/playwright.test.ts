import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runPlaywrightCase } from "../../../dist/qa-agent/runner/playwright";
import type { UiCase } from "../../../dist/qa-agent/runner/types";

const timeoutMs = 10_000;

function startPageServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
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
        reject(new Error("failed to bind page server"));
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

test("Playwright UI case passes and fails predictably", async () => {
  const server = await startPageServer();
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

    const passBefore = path.join(screenshotDir, "pass-before.png");
    const passAfter = path.join(screenshotDir, "pass-after.png");
    const failBefore = path.join(screenshotDir, "fail-before.png");
    const failAfter = path.join(screenshotDir, "fail-after.png");

    const pass = await runPlaywrightCase(passing, {
      baseUrl: server.baseUrl,
      timeoutMs,
      screenshotBeforePath: passBefore,
      screenshotAfterPath: passAfter,
    });
    const fail = await runPlaywrightCase(failing, {
      baseUrl: server.baseUrl,
      timeoutMs,
      screenshotBeforePath: failBefore,
      screenshotAfterPath: failAfter,
    });

    assert.equal(pass.ok, true);
    assert.equal(fail.ok, false);
    assert.ok(fs.existsSync(passBefore));
    assert.ok(fs.existsSync(passAfter));
    assert.ok(fs.existsSync(failBefore));
    assert.ok(fs.existsSync(failAfter));
  } finally {
    await server.close();
  }
});
