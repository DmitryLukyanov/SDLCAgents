/**
 * Shared template utilities for loading and filling message templates.
 *
 * Usage:
 *   import { loadTemplate, fillTemplate } from '../../lib/template-utils.js';
 *
 *   const TMPL = loadTemplate(import.meta.url, 'templates', 'my-message.md');
 *   const body = fillTemplate(TMPL, { ISSUE_KEY: 'PROJ-123' });
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Replaces all `{{KEY}}` placeholders in `template` with the corresponding
 * value from `vars`. Keys with no matching entry are left unchanged.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Loads a template file synchronously, resolved relative to the calling
 * module's location. Pass `import.meta.url` as the first argument.
 *
 * Example — load `templates/foo.md` from the same directory as the caller:
 *   loadTemplate(import.meta.url, 'templates', 'foo.md')
 *
 * Example — load from a sibling directory:
 *   loadTemplate(import.meta.url, '..', 'templates', 'foo.md')
 */
export function loadTemplate(importMetaUrl: string, ...segments: string[]): string {
  const dir = join(fileURLToPath(importMetaUrl), '..');
  return readFileSync(join(dir, ...segments), 'utf8').trim();
}
