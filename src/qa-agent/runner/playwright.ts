import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import {
  resolveUrl,
  type RunResult,
  type UiCase,
  type UiStep,
} from "./types";

export async function runPlaywrightCase(
  testCase: UiCase,
  options: {
    baseUrl: string;
    timeoutMs: number;
    screenshotBeforePath: string;
    screenshotAfterPath: string;
  },
): Promise<RunResult & { screenshotBefore?: string; screenshotAfter?: string }> {
  fs.mkdirSync(path.dirname(options.screenshotBeforePath), { recursive: true });
  fs.mkdirSync(path.dirname(options.screenshotAfterPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(options.timeoutMs);
  let screenshotBefore: string | undefined;

  try {
    for (const step of testCase.steps) {
      await runStep(page, step, options.baseUrl);
      if (!screenshotBefore && step.action === "goto") {
        await page.screenshot({ path: options.screenshotBeforePath });
        screenshotBefore = options.screenshotBeforePath;
      }
    }
    return { ok: true, screenshotBefore, screenshotAfter: options.screenshotAfterPath };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      screenshotBefore,
      screenshotAfter: options.screenshotAfterPath,
    };
  } finally {
    await page.screenshot({ path: options.screenshotAfterPath });
    await browser.close();
  }
}

async function runStep(
  page: Page,
  step: UiStep,
  baseUrl: string,
): Promise<void> {
  if (step.action === "goto") {
    await page.goto(resolveUrl(baseUrl, step.url));
    return;
  }

  if (step.action === "click") {
    await page.locator(step.selector).click();
    return;
  }

  if (step.action === "fill") {
    await page.locator(step.selector).fill(step.value);
    return;
  }

  if (step.action === "expectText") {
    if (step.selector) {
      const text = await page.locator(step.selector).innerText();
      if (!text.includes(step.text)) {
        throw new Error(
          `expected "${step.text}" in ${step.selector}, got "${text}"`,
        );
      }
      return;
    }

    await page.getByText(step.text).first().waitFor();
    return;
  }

  if (step.action === "expectUrl") {
    const actual = page.url();
    if (!actual.includes(step.url)) {
      throw new Error(`expected URL to include "${step.url}", got "${actual}"`);
    }
    return;
  }

  throw new Error(`unsupported UI action: ${(step as UiStep).action}`);
}
