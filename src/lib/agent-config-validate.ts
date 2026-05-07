/**
 * Unified config validation: router vs pipeline agent kinds (FR-010, FR-011).
 */
import { assertPipelineRunnerImplemented } from './pipeline-runner-registry.js';
import { type AgentJsonWithPipeline, type PipelineStepConfig } from './pipeline-config.js';

export type AgentConfigKind = 'router' | 'pipeline_agent';

export function formatConfigValidationError(configPath: string, kind: AgentConfigKind, message: string): string {
  return `${configPath} [${kind}] ${message}`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

/** Router: top-level non-empty `rules[]` (FR-010). */
export function detectAgentConfigKind(root: unknown): AgentConfigKind | null {
  if (!isRecord(root)) return null;
  if (Array.isArray(root.rules) && root.rules.length > 0) return 'router';
  const params = root.params;
  if (isRecord(params) && Array.isArray(params.steps) && params.steps.length > 0) return 'pipeline_agent';
  return null;
}

/** Validate Scrum Master–style `rules[]` entries (enabled rules only). */
export function validateRouterRules(rules: unknown, configPath: string): void {
  const kind: AgentConfigKind = 'router';
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error(formatConfigValidationError(configPath, kind, 'rules must be a non-empty array'));
  }
  rules.forEach((rule, index) => {
    if (!isRecord(rule)) {
      throw new Error(formatConfigValidationError(configPath, kind, `rules[${index}] must be an object`));
    }
    if (rule.enabled === false) return;
    const jql = rule.jql;
    if (typeof jql !== 'string' || !jql.trim()) {
      throw new Error(formatConfigValidationError(configPath, kind, `rules[${index}]: "jql" is required`));
    }
    const configFile = rule.configFile;
    if (typeof configFile !== 'string' || !configFile.trim()) {
      throw new Error(formatConfigValidationError(configPath, kind, `rules[${index}]: "configFile" is required`));
    }
    const wf = typeof rule.workflowFile === 'string' ? rule.workflowFile.trim() : '';
    if (wf && !wf.endsWith('.yml') && !wf.endsWith('.yaml')) {
      throw new Error(
        formatConfigValidationError(
          configPath,
          kind,
          `rules[${index}]: workflowFile should be a YAML workflow filename (got "${rule.workflowFile}")`,
        ),
      );
    }
  });
}

/** True when pipeline likely uses an LLM / Codex (FR-005). */
export function pipelineConfigUsesAiModel(steps: PipelineStepConfig[]): boolean {
  for (const s of steps) {
    if (s.runner === 'spec_kit_step' || s.runner === 'async_operation' || s.runner === 'async_terminal_operation') {
      return true;
    }
    if (s.async_call) return true;
  }
  return false;
}

export function getPipelineAgentModel(root: AgentJsonWithPipeline): string {
  const top = root.model != null ? String(root.model).trim() : '';
  if (top) return top;
  const params = root.params;
  if (params && typeof params === 'object' && params !== null && 'model' in params) {
    const m = (params as { model?: unknown }).model;
    if (m != null && String(m).trim()) return String(m).trim();
  }
  return '';
}

export function validatePipelineAgentShape(
  root: AgentJsonWithPipeline,
  steps: PipelineStepConfig[],
  configPath: string,
): void {
  const kind: AgentConfigKind = 'pipeline_agent';
  const name = root.name != null ? String(root.name).trim() : '';
  if (!name) {
    throw new Error(formatConfigValidationError(configPath, kind, 'missing required "name"'));
  }
  const desc = root.description != null ? String(root.description).trim() : '';
  if (!desc) {
    throw new Error(formatConfigValidationError(configPath, kind, 'missing required "description"'));
  }
  if (pipelineConfigUsesAiModel(steps)) {
    const model = getPipelineAgentModel(root);
    if (!model) {
      throw new Error(
        formatConfigValidationError(
          configPath,
          kind,
          'missing "model" (required for AI-using pipeline agents: set top-level "model" or params.model)',
        ),
      );
    }
  }
  for (const step of steps) {
    const label = formatConfigValidationError(configPath, kind, `step "${step.id ?? step.runner}"`);
    assertPipelineRunnerImplemented(step.runner, label);
  }
}
