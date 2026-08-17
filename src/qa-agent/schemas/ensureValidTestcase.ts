import fs from "node:fs";
import path from "node:path";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

export type EnsureValidTestcaseResult =
  | { ok: true }
  | { ok: false; errors: string };

const schemaPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "schemas",
  "testcase.schema.json",
);

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as object;

const ajv = new Ajv2020({ allErrors: true });
const validate: ValidateFunction = ajv.compile(schema);

export function ensureValidTestcase(
  data: unknown,
): EnsureValidTestcaseResult {
  if (validate(data)) {
    return { ok: true };
  }

  const errors = validate.errors ?? [];
  return {
    ok: false,
    errors: formatErrors(errors),
  };
}

function formatErrors(errors: ErrorObject[]): string {
  return errors
    .map((error) => {
      const where = error.instancePath || "/";
      return `${where} ${error.message ?? "invalid"}`;
    })
    .join("; ");
}
