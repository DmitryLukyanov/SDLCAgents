/**
 * Resolve the path to `speckit-state.json` for a feature (by Jira/issue key).
 *
 * Checks the legacy fixed location first (`.specify/features/{key}/`) for
 * backward compatibility. If the specify step used a different layout, `find`
 * picks up the first match under the repo (excluding `.git` and `.sdlc-agents`).
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function findSpeckitStateFilePath(issueKey: string): string {
  const legacy = `.specify/features/${issueKey}/speckit-state.json`;
  if (existsSync(legacy)) return legacy;

  try {
    const found = execSync(
      `find . -maxdepth 5 -name 'speckit-state.json' -not -path './.git/*' -not -path './.sdlc-agents/*' 2>/dev/null | head -1`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
      .trim()
      .replace(/^\.\//, '');
    if (found) return found;
  } catch {
    /* fall through */
  }

  return legacy;
}
