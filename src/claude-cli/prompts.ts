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

function formatChangedFiles(pr: PromptPrContext): string {
  return pr.changedFiles
    .map((file) => {
      const patch = file.patch ? `\n${file.patch}` : "";
      return `### ${file.status}: ${file.filename}${patch}`;
    })
    .join("\n\n");
}

function applyPrPlaceholders(template: string, pr: PromptPrContext): string {
  return template
    .replaceAll("{{PR_NUMBER}}", String(pr.number))
    .replaceAll("{{PR_TITLE}}", pr.title)
    .replaceAll("{{PR_BODY}}", pr.body)
    .replaceAll("{{CHANGED_FILES}}", formatChangedFiles(pr));
}

export function buildTestcasePrompt(
  template: string,
  pr: PromptPrContext,
  schemaJson: string,
): string {
  return applyPrPlaceholders(template, pr).replaceAll(
    "{{SCHEMA_JSON}}",
    schemaJson,
  );
}

export function buildRepairPrompt(
  template: string,
  pr: PromptPrContext,
  schemaJson: string,
  validationErrors: string,
  previousJson: string,
): string {
  return applyPrPlaceholders(template, pr)
    .replaceAll("{{SCHEMA_JSON}}", schemaJson)
    .replaceAll("{{VALIDATION_ERRORS}}", validationErrors)
    .replaceAll("{{PREVIOUS_JSON}}", previousJson);
}
