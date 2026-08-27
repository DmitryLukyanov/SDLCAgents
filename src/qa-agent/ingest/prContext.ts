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

export function resolvePullNumber(payload: {
  pull_request?: { number?: number };
  issue?: { number?: number; pull_request?: unknown };
}): number {
  if (payload.pull_request?.number) {
    return payload.pull_request.number;
  }
  if (payload.issue?.pull_request && payload.issue.number) {
    return payload.issue.number;
  }
  throw new Error("Not a pull request event");
}

export async function loadPrContext(token: string): Promise<PrContext> {
  const pull_number = resolvePullNumber(github.context.payload);
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

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
