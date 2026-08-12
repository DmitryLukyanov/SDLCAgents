import * as github from "@actions/github";

export type PrChangedFile = {
  filename: string;
  status: string;
  patch?: string;
};

export type PrContext = {
  number: number;
  title: string;
  body: string;
  changedFiles: PrChangedFile[];
};

export async function loadPrContext(token: string): Promise<PrContext> {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("Not a pull_request event");
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const pull_number = pullRequest.number;

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    changedFiles: files.map((file) => ({
      filename: file.filename,
      status: file.status,
      patch: file.patch,
    })),
  };
}
