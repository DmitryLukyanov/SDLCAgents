export type RunResult =
  | { ok: true }
  | { ok: false; error: string };

export type UiStep =
  | { action: "goto"; url: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "expectText"; text: string; selector?: string }
  | { action: "expectUrl"; url: string };

export type UiCase = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  type: "ui";
  steps: UiStep[];
};

export type ApiCase = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  type: "api";
  request: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
  };
  asserts: {
    status: number;
    bodyContains?: string;
  };
};

export function resolveUrl(baseUrl: string, urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) {
    return urlOrPath;
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relative = urlOrPath.startsWith("/") ? urlOrPath.slice(1) : urlOrPath;
  return new URL(relative, base).href;
}
