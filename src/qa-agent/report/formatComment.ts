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

export function formatTestcaseComment(
  data: unknown,
  mode: "plan-only" | "plan-and-run",
  runResults: CommentRunResult[] = [],
): string {
  const cases =
    data &&
    typeof data === "object" &&
    Array.isArray((data as { cases?: unknown }).cases)
      ? (data as { cases: CommentCase[] }).cases
      : [];

  const resultById = new Map(runResults.map((result) => [result.id, result]));

  const lines = [
    "<!-- qa-agent-report -->",
    `## QA Agent — testcases (${mode})`,
    "",
  ];

  if (cases.length === 0) {
    lines.push("_No cases in generated output._");
  } else {
    for (const testCase of cases) {
      const id = String(testCase.id);
      lines.push(
        `- **${id}** (${String(testCase.priority)}, ${String(testCase.type)}): ${String(testCase.title)}${formatRunSuffix(mode, resultById.get(id))}`,
      );
    }
  }

  return lines.join("\n");
}

function formatRunSuffix(
  mode: "plan-only" | "plan-and-run",
  result: CommentRunResult | undefined,
): string {
  if (mode !== "plan-and-run" || !result) {
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
