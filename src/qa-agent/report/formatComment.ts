type CommentCase = {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  type?: unknown;
};

export function formatTestcaseComment(data: unknown): string {
  const cases =
    data &&
    typeof data === "object" &&
    Array.isArray((data as { cases?: unknown }).cases)
      ? ((data as { cases: CommentCase[] }).cases)
      : [];

  const lines = [
    "<!-- qa-agent-report -->",
    "## QA Agent — testcases (plan-only)",
    "",
  ];

  if (cases.length === 0) {
    lines.push("_No cases in generated output._");
  } else {
    for (const testCase of cases) {
      lines.push(
        `- **${String(testCase.id)}** (${String(testCase.priority)}, ${String(testCase.type)}): ${String(testCase.title)}`,
      );
    }
  }

  return lines.join("\n");
}
