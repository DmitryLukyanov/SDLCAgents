import fs from "node:fs";

export type PromptPrContext = {
  number: number;
  title: string;
  body: string;
  changedFiles: Array<{
    filename: string;
    status: string;
    patch?: string;
  }>;
};

export function loadPromptTemplate(templatePath: string): string {
  return fs.readFileSync(templatePath, "utf8");
}

export function buildTestcasePrompt(
  template: string,
  pr: PromptPrContext,
  schemaJson: string,
): string {
  const changedFiles = pr.changedFiles
    .map((file) => {
      const patch = file.patch ? `\n${file.patch}` : "";
      return `### ${file.status}: ${file.filename}${patch}`;
    })
    .join("\n\n");

  return template
    .replaceAll("{{SCHEMA_JSON}}", schemaJson)
    .replaceAll("{{PR_NUMBER}}", String(pr.number))
    .replaceAll("{{PR_TITLE}}", pr.title)
    .replaceAll("{{PR_BODY}}", pr.body)
    .replaceAll("{{CHANGED_FILES}}", changedFiles);
}
