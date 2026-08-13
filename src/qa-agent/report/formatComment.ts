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

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
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

export function formatSummaryTable(
  data: unknown,
  runResults: CommentRunResult[],
): string {
  const cases = getCases(data);
  const resultById = new Map(runResults.map((result) => [result.id, result]));
  const lines = [
    "## QA Agent — testcases",
    "",
    "| ID | Priority | Type | Title | Result |",
    "| --- | --- | --- | --- | --- |",
  ];

  if (cases.length === 0) {
    return ["## QA Agent — testcases", "", "_No cases in generated output._"].join(
      "\n",
    );
  }

  for (const testCase of cases) {
    const id = String(testCase.id);
    lines.push(
      `| ${escapeCell(id)} | ${escapeCell(String(testCase.priority))} | ${escapeCell(String(testCase.type))} | ${escapeCell(String(testCase.title))} | ${escapeCell(formatResult(resultById.get(id)))} |`,
    );
  }

  return lines.join("\n");
}
