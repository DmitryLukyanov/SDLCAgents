import { readPipelineAgentConfigFile } from '../../lib/agent-config-file.js';
import { validatePipelineAgentShape } from '../../lib/agent-config-validate.js';
import {
  parseAgentPipelineSteps,
  type PipelineStepConfig,
} from '../../lib/pipeline-config.js';
import type { SmDispatchStep } from './sm-types.js';

/** Parsed `scrum-master.config` (pipeline: each step is `sm_dispatch_rule` → {@link SmDispatchStep}). */
export interface LoadedScrumMasterConfig {
  steps: SmDispatchStep[];
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function parseSmDispatchStep(step: PipelineStepConfig, index: number, configPath: string): SmDispatchStep {
  if (step.runner !== 'sm_dispatch_rule') {
    throw new Error(
      `${configPath}: step ${index}: runner must be "sm_dispatch_rule" (got "${String(step.runner)}")`,
    );
  }
  const s = step as Record<string, unknown>;
  if (s.enabled === false) {
    return {
      enabled: false,
      jql: str(s.jql) ?? '',
      configFile: str(s.configFile) ?? '',
    };
  }
  const jql = str(s.jql);
  const configFile = str(s.configFile);
  if (!jql) {
    throw new Error(`${configPath}: step ${index} (sm_dispatch_rule): "jql" is required when enabled is not false`);
  }
  if (!configFile) {
    throw new Error(`${configPath}: step ${index} (sm_dispatch_rule): "configFile" is required when enabled is not false`);
  }
  const wf = str(s.workflowFile);
  if (!wf) {
    throw new Error(
      `${configPath}: step ${index} (sm_dispatch_rule): "workflowFile" is required when enabled is not false`,
    );
  }
  if (!wf.endsWith('.yml') && !wf.endsWith('.yaml')) {
    throw new Error(`${configPath}: step ${index}: workflowFile must be .yml or .yaml`);
  }
  return {
    description: str(s.description),
    requiredJiraStatus: str(s.requiredJiraStatus),
    postReadStatus: str(s.postReadStatus),
    jql,
    configFile,
    workflowFile: wf,
    limit: num(s.limit),
    skipIfLabel: str(s.skipIfLabel),
    addLabel: str(s.addLabel),
    enabled: typeof s.enabled === 'boolean' ? s.enabled : undefined,
    stopIfDispatched: s.stopIfDispatched === true,
  };
}

export async function loadSmConfig(filePath: string): Promise<LoadedScrumMasterConfig> {
  const { raw, root } = await readPipelineAgentConfigFile(filePath);
  const parsedSteps = parseAgentPipelineSteps(raw, filePath);
  validatePipelineAgentShape(root, parsedSteps, filePath);
  const steps = parsedSteps.map((p, i) => parseSmDispatchStep(p, i, filePath));
  return { steps };
}

/** Replace {jiraProject} in JQL when JIRA_PROJECT env is set. */
export function interpolateJql(jql: string): string {
  const project = process.env.JIRA_PROJECT?.trim();
  if (!project) return jql;
  return jql.replaceAll('{jiraProject}', project);
}
