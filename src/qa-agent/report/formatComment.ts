type CommentCase = {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  type?: unknown;
};

export type CommentRunResult = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  screenshot?: string;
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

function screenshotCell(
  id: string,
  runResult: CommentRunResult | undefined,
  screenshotBaseUrl?: string,
): string {
  if (!screenshotBaseUrl || !runResult?.screenshot) {
    return "—";
  }

  const src = `${screenshotBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(id)}.png`;
  return `<img src="${src}" alt="${escapeHtml(id)}" width="240" />`;
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
      { data: "Result", header: true },
      { data: "Screenshot", header: true },
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
      { data: escapeHtml(formatResult(runResult)) },
      { data: screenshotCell(id, runResult, screenshotBaseUrl) },
    ]);
  }

  return rows;
}
