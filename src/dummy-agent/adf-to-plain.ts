/**
 * Best-effort plain text from Jira Cloud ADF (description, comments).
 */

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
}

export function adfToPlain(adf: unknown): string {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;

  function walk(nodes: AdfNode[] | undefined): string {
    let s = '';
    for (const n of nodes || []) {
      if (!n) continue;
      if (n.type === 'text' && n.text) s += n.text;
      if (n.content) s += walk(n.content);
      if (n.type === 'hardBreak') s += '\n';
    }
    return s;
  }

  const doc = adf as { content?: AdfNode[] };
  if (doc.content) return walk(doc.content).replace(/\n{3,}/g, '\n\n').trim();
  return '';
}
