import * as github from "@actions/github";
import { resolvePullNumber } from "../ingest/prContext";

export async function postPrComment(
  token: string,
  body: string,
): Promise<void> {
  const issue_number = resolvePullNumber(github.context.payload);
  const octokit = github.getOctokit(token);
  await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number,
    body,
  });
}
