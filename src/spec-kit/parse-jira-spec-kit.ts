import type { SpecKitJiraOverrides } from './spec-kit-types.js';

/**
 * Looks for a fenced ```spec-kit or ```json block containing JSON with optional
 * keys: specify, plan, tasks (all strings).
 */
export function parseSpecKitBlockFromPlainDescription(plain: string): SpecKitJiraOverrides {
  const re = /```(?:spec-kit|json)\s*\n?([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const inner = m[1]?.trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner) as unknown;
      if (!parsed || typeof parsed !== 'object') continue;
      const o = parsed as Record<string, unknown>;
      const wrap = o.specKit && typeof o.specKit === 'object' ? (o.specKit as Record<string, unknown>) : o;
      const out: SpecKitJiraOverrides = {};
      for (const k of ['globalDirective', 'specify', 'plan', 'tasks'] as const) {
        const v = wrap[k];
        if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      }
      if (Object.keys(out).length > 0) return out;
    } catch {
      continue;
    }
  }
  return {};
}
