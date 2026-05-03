import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SmConfig } from './sm-types.js';

export async function loadSmConfig(filePath: string): Promise<SmConfig> {
  const abs = resolve(process.cwd(), filePath);
  const raw = await readFile(abs, 'utf8');
  const data = JSON.parse(raw) as SmConfig;
  if (!data.rules || !Array.isArray(data.rules)) {
    throw new Error(`Scrum Master config must contain a "rules" array: ${abs}`);
  }
  return data;
}

/** Replace {jiraProject} in JQL when JIRA_PROJECT env is set. */
export function interpolateJql(jql: string): string {
  const project = process.env.JIRA_PROJECT?.trim();
  if (!project) return jql;
  return jql.replaceAll('{jiraProject}', project);
}
