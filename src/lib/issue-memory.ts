/**
 * GitHub issue durable memory: body snapshot + timeline comments (FR-003, FR-009, FR-020).
 * Concurrent writers: callers should keep comments idempotent where possible; GitHub does not guarantee global ordering.
 */
import type { Octokit } from '@octokit/rest';

export type ConfigIdentity = {
  config_file_path: string;
  workflow_ref: string;
};

const SECRET_PATTERNS: RegExp[] = [
  /ghp_[a-zA-Z0-9]{20,}/g,
  /gho_[a-zA-Z0-9]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{20,}/g,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
  /OPENAI_API_KEY[=:]\s*\S+/gi,
];

/** Best-effort redaction before writing to issues (FR-020). */
export function redactSecretsFromText(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[redacted]');
  }
  return out;
}

export async function updateIssueBodyOrThrow(
  octokit: Octokit,
  owner: string,
  repo: string,
  issue_number: number,
  body: string,
): Promise<void> {
  const safe = redactSecretsFromText(body);
  await octokit.rest.issues.update({ owner, repo, issue_number, body: safe });
}

export async function createIssueCommentOrThrow(
  octokit: Octokit,
  owner: string,
  repo: string,
  issue_number: number,
  body: string,
): Promise<void> {
  const safe = redactSecretsFromText(body);
  await octokit.rest.issues.createComment({ owner, repo, issue_number, body: safe });
}
