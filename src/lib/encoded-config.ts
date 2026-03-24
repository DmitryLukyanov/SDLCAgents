/**
 * dmtools-style payload: URL-encoded JSON { params: { inputJql, customParams? } }.
 * Decode side — used by agent-runner; encode builder lives under scrum-agent/.
 */

export interface EncodedConfigParams {
  inputJql?: string;
  customParams?: Record<string, string | undefined>;
}

export interface EncodedConfigRoot {
  params?: EncodedConfigParams;
}

export function decodeEncodedConfig(encoded: string): EncodedConfigRoot {
  const raw = decodeURIComponent(encoded.trim());
  const parsed = JSON.parse(raw) as EncodedConfigRoot;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('encoded_config: invalid JSON root');
  }
  return parsed;
}

/** Parses `key = PROJ-123` / `key=PROJ-123` from inputJql. */
export function extractIssueKeyFromEncoded(root: EncodedConfigRoot): string {
  const jql = root.params?.inputJql?.trim();
  if (!jql) throw new Error('encoded_config.params.inputJql is required');

  const m = jql.match(/key\s*=\s*([A-Za-z0-9]+-\d+)/i);
  if (!m?.[1]) {
    throw new Error(`encoded_config: could not parse issue key from inputJql: ${jql}`);
  }
  return m[1].toUpperCase();
}
