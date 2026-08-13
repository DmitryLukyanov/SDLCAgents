type CommentCase = {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  type?: unknown;
  steps?: unknown;
  request?: unknown;
  asserts?: unknown;
};

export type CommentRunResult = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
};

function getCases(data: unknown): CommentCase[] {
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { cases?: unknown }).cases)
  ) {
    return (data as { cases: CommentCase[] }).cases;
  }
  return [];
}

export function formatTestcaseComment(
  data: unknown,
  runResults: CommentRunResult[],
): string {
  const cases = getCases(data);
  const resultById = new Map(runResults.map((result) => [result.id, result]));

  const lines = ["<!-- qa-agent-report -->", "## QA Agent — testcases", ""];

  if (cases.length === 0) {
    lines.push("_No cases in generated output._");
  } else {
    for (const testCase of cases) {
      const id = String(testCase.id);
      lines.push(
        `- **${id}** (${String(testCase.priority)}, ${String(testCase.type)}): ${String(testCase.title)}${formatRunSuffix(resultById.get(id))}`,
      );
    }
  }

  return lines.join("\n");
}

function formatRunSuffix(result: CommentRunResult | undefined): string {
  if (!result) {
    return "";
  }
  if (result.skipped) {
    return " — skipped";
  }
  if (result.ok) {
    return " — PASS";
  }
  return ` — FAIL: ${result.error ?? "unknown"}`;
}

function formatResult(result: CommentRunResult | undefined): string {
  if (!result) {
    return "";
  }
  if (result.skipped) {
    return "skipped";
  }
  if (result.ok) {
    return "PASS";
  }
  return `FAIL: ${result.error ?? "unknown"}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(/\r?\n/g, " ");
}

function formatStep(step: unknown): string {
  if (!step || typeof step !== "object") {
    return String(step);
  }

  const s = step as Record<string, unknown>;
  const action = String(s.action ?? "");
  if (action === "goto") {
    return `goto ${String(s.url ?? "")}`;
  }
  if (action === "click") {
    return `click ${String(s.selector ?? "")}`;
  }
  if (action === "fill") {
    return `fill ${String(s.selector ?? "")} = ${String(s.value ?? "")}`;
  }
  if (action === "expectText") {
    return s.selector
      ? `expectText "${String(s.text ?? "")}" in ${String(s.selector)}`
      : `expectText "${String(s.text ?? "")}"`;
  }
  if (action === "expectUrl") {
    return `expectUrl ${String(s.url ?? "")}`;
  }
  return action;
}

function formatSteps(testCase: CommentCase): string {
  if (testCase.type === "api") {
    if (!testCase.request || typeof testCase.request !== "object") {
      return "—";
    }
    const request = testCase.request as {
      method?: unknown;
      path?: unknown;
    };
    const asserts =
      testCase.asserts && typeof testCase.asserts === "object"
        ? (testCase.asserts as { status?: unknown; bodyContains?: unknown })
        : undefined;
    const parts = [`${String(request.method ?? "")} ${String(request.path ?? "")}`];
    if (asserts?.status !== undefined) {
      parts.push(`status ${String(asserts.status)}`);
    }
    if (asserts?.bodyContains) {
      parts.push(`body contains ${String(asserts.bodyContains)}`);
    }
    return escapeHtml(parts.join(" → "));
  }

  if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
    return "—";
  }

  return testCase.steps
    .map((step, index) => escapeHtml(`${index + 1}. ${formatStep(step)}`))
    .join("<br>");
}

function screenshotCell(
  fileName: string | undefined,
  screenshotBaseUrl?: string,
): string {
  if (!screenshotBaseUrl || !fileName) {
    return "—";
  }

  const src = `${screenshotBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(fileName)}`;
  return `<img src="${src}" alt="${escapeHtml(fileName)}" width="240" />`;
}

function screenshotFileName(screenshotPath: string | undefined): string | undefined {
  if (!screenshotPath) {
    return undefined;
  }
  return screenshotPath.replace(/\\/g, "/").split("/").pop();
}

export type SummaryTableCell = {
  data: string;
  header?: boolean;
};

export function buildSummaryTableRows(
  data: unknown,
  runResults: CommentRunResult[],
  screenshotBaseUrl?: string,
): SummaryTableCell[][] {
  const cases = getCases(data);
  const resultById = new Map(runResults.map((result) => [result.id, result]));
  const rows: SummaryTableCell[][] = [
    [
      { data: "ID", header: true },
      { data: "Priority", header: true },
      { data: "Type", header: true },
      { data: "Title", header: true },
      { data: "Steps", header: true },
      { data: "Result", header: true },
      { data: "Before", header: true },
      { data: "After", header: true },
    ],
  ];

  for (const testCase of cases) {
    const id = String(testCase.id);
    const runResult = resultById.get(id);
    rows.push([
      { data: escapeHtml(id) },
      { data: escapeHtml(String(testCase.priority)) },
      { data: escapeHtml(String(testCase.type)) },
      { data: escapeHtml(String(testCase.title)) },
      { data: formatSteps(testCase) },
      { data: escapeHtml(formatResult(runResult)) },
      {
        data: screenshotCell(
          screenshotFileName(runResult?.screenshotBefore),
          screenshotBaseUrl,
        ),
      },
      {
        data: screenshotCell(
          screenshotFileName(runResult?.screenshotAfter),
          screenshotBaseUrl,
        ),
      },
    ]);
  }

  return rows;
}
