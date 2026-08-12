import * as github from "@actions/github";

export async function postPrComment(
  token: string,
  body: string,
): Promise<void> {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("Not a pull_request event");
  }

  const octokit = github.getOctokit(token);
  await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pullRequest.number,
    body,
  });
}
