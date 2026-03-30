/**
 * Business Analyst orchestration — dependency-injected for tests / local debug.
 *
 * Reads ALL Jira data (summary, description, comments, related issues),
 * classifies content into 5 spec-kit-aligned fields via GitHub Models API,
 * then either dispatches AI Teammate with enriched per-step inputs or
 * blocks the ticket asking for missing information.
 */

import { appendFile } from 'node:fs/promises';

import type { JiraIssueFields } from '../../lib/jira/jira-types.js';
import type { RelatedIssueSummary } from '../../lib/jira/jira-related.js';
import { adfToPlain } from '../../lib/adf-to-plain.js';
import type {
  BaAnalysisResult,
  BaOutcome,
  JiraComment,
  RelatedIssueBrief,
  TicketContext,
} from './ba-types.js';

/* ------------------------------------------------------------------ */
/*  Context & Dependencies                                             */
/* ------------------------------------------------------------------ */

export interface BusinessAnalystContext {
  owner: string;
  repo: string;
  ref: string;
  issueKey: string;
  configFile: string;
  encodedConfig: string;
  /** GitHub Models API model override (default: openai/gpt-4o). */
  model?: string;
  /** Depth for fetching related issues. Default 1. */
  ticketContextDepth: number;
  /** Workflow file to dispatch for AI Teammate (default: ai-teammate.yml). */
  aiTeammateWorkflowFile: string;
  /** Status to transition ticket to when blocked. */
  blockedStatusName: string;
  /** Label added after BA analysis to prevent re-processing. */
  analyzedLabel: string;
}

export interface BusinessAnalystDeps {
  getIssue: (
    issueKey: string,
    fields: string[],
  ) => Promise<{ key: string; fields?: JiraIssueFields }>;
  addIssueComment: (issueKey: string, plainText: string) => Promise<void>;
  addIssueLabel: (issueKey: string, label: string) => Promise<void>;
  transitionIssueToStatusName: (
    issueKey: string,
    targetStatusName: string,
  ) => Promise<void>;
  fetchRelatedIssueSummaries: (
    primaryKey: string,
    depth: number,
  ) => Promise<RelatedIssueSummary[]>;
  analyzeTicket: (
    ctx: TicketContext,
    githubToken: string,
    model?: string,
  ) => Promise<BaOutcome>;
  dispatchWorkflow: (args: {
    owner: string;
    repo: string;
    workflow_id: string;
    ref: string;
    inputs: Record<string, string>;
  }) => Promise<void>;
  /** GitHub token for Models API. */
  githubToken: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export const BA_COMMENT_MARKERS = [
  '🤖 Business Analyst — Missing Information',
  'Business Analyst — Missing Information',
  'Business Analyst analysis complete',
  'Ticket taken into processing',
];

export function isBAGeneratedComment(body: string): boolean {
  return BA_COMMENT_MARKERS.some((marker) => body.includes(marker));
}

export function extractComments(fields: JiraIssueFields | undefined): JiraComment[] {
  const raw = fields?.comment?.comments ?? [];
  return raw.map((c) => {
    const body = adfToPlain(c.body);
    return {
      author: c.author?.displayName ?? 'Unknown',
      body,
      created: c.created ?? '',
      isBAGenerated: isBAGeneratedComment(body),
    };
  });
}

export function mapRelated(items: RelatedIssueSummary[]): RelatedIssueBrief[] {
  return items.map((r) => ({
    key: r.key,
    summary: r.summary ?? '(no summary)',
    status: r.status ?? 'Unknown',
    type: r.issuetype ?? 'Unknown',
  }));
}

/** Same limits for console log and GitHub job Summary (`GITHUB_STEP_SUMMARY`). */
export const INPUT_SUMMARY_LIMITS = {
  summary: 2000,
  description: 4000,
  commentBody: 800,
  relatedSummary: 200,
} as const;

/** Truncate for log output; keeps CI logs readable while showing what was read from Jira. */
export function previewForLog(text: string, maxChars: number): string {
  const t = text.trim();
  if (!t) return '(empty)';
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}… (${t.length} chars total)`;
}

/** Fenced block with a long enough fence so Jira text cannot break Markdown. */
function markdownFencedBlock(content: string): string {
  let fence = '```';
  while (content.includes(fence)) {
    fence += '`';
  }
  return `${fence}\n${content}\n${fence}\n`;
}

function markdownTableCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function buildInputTicketSummaryMarkdown(ctx: TicketContext): string {
  const sumPrev = previewForLog(ctx.summary, INPUT_SUMMARY_LIMITS.summary);
  const descPrev = previewForLog(ctx.description, INPUT_SUMMARY_LIMITS.description);

  const lines: string[] = [
    '## Business Analyst — input read from Jira',
    '',
    `**Issue:** \`${ctx.issueKey}\``,
    '',
    `### Summary (${ctx.summary.length} chars)`,
    '',
    markdownFencedBlock(sumPrev),
    '',
    `### Description (${ctx.description.length} chars)`,
    '',
    markdownFencedBlock(descPrev),
    '',
    `### Comments (${ctx.comments.length})`,
    '',
  ];

  ctx.comments.forEach((c, i) => {
    const n = i + 1;
    const bodyPrev = previewForLog(c.body, INPUT_SUMMARY_LIMITS.commentBody);
    lines.push(`#### Comment ${n}/${ctx.comments.length}`);
    lines.push('');
    lines.push(`**${c.author}** · ${c.created || '(no date)'}`);
    lines.push('');
    lines.push(markdownFencedBlock(bodyPrev));
    lines.push('');
  });

  lines.push(`### Related issues (${ctx.relatedIssues.length})`);
  lines.push('');
  if (ctx.relatedIssues.length === 0) {
    lines.push('*(none)*');
    lines.push('');
  } else {
    lines.push('| Key | Type | Status | Summary |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of ctx.relatedIssues) {
      const sum = previewForLog(r.summary, INPUT_SUMMARY_LIMITS.relatedSummary).replace(
        /\r?\n/g,
        ' ',
      );
      lines.push(
        `| ${markdownTableCell(r.key)} | ${markdownTableCell(r.type)} | ${markdownTableCell(r.status)} | ${markdownTableCell(sum)} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function appendGithubStepSummary(markdown: string): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (!path) return;
  try {
    await appendFile(path, `${markdown}\n`, 'utf8');
  } catch (e) {
    console.warn('Could not append to GITHUB_STEP_SUMMARY (non-fatal):', e);
  }
}

export function printInputTicketSummary(ctx: TicketContext): void {
  console.log('\n── Input ticket summary (data read from Jira) ──');
  console.log(`   Issue key: ${ctx.issueKey}`);
  console.log(`   Summary (${ctx.summary.length} chars):`);
  for (const line of previewForLog(ctx.summary, INPUT_SUMMARY_LIMITS.summary).split('\n')) {
    console.log(`      ${line}`);
  }
  console.log(`   Description (${ctx.description.length} chars):`);
  for (const line of previewForLog(ctx.description, INPUT_SUMMARY_LIMITS.description).split('\n')) {
    console.log(`      ${line}`);
  }
  console.log(`   Comments: ${ctx.comments.length}`);
  ctx.comments.forEach((c, i) => {
    const n = i + 1;
    console.log(`      [${n}/${ctx.comments.length}] ${c.author} @ ${c.created || '(no date)'}`);
    for (const line of previewForLog(c.body, INPUT_SUMMARY_LIMITS.commentBody).split('\n')) {
      console.log(`         ${line}`);
    }
  });
  console.log(`   Related issues: ${ctx.relatedIssues.length}`);
  for (const r of ctx.relatedIssues) {
    const sum = previewForLog(r.summary, INPUT_SUMMARY_LIMITS.relatedSummary).replace(/\n/g, ' ');
    console.log(`      ${r.key} [${r.type}] ${r.status} — ${sum}`);
  }
  console.log('── End input ticket summary ──');
}

/**
 * Inject BA analysis results into the encoded_config so AI Teammate
 * can read them from customParams.
 */
export function enrichEncodedConfig(
  existingEncoded: string,
  result: BaAnalysisResult,
): string {
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(decodeURIComponent(existingEncoded.trim()));
  } catch {
    root = { params: {} };
  }

  const params = (root.params ?? {}) as Record<string, unknown>;
  const custom = (params.customParams ?? {}) as Record<string, string>;

  // Add BA analysis as a JSON string in customParams
  custom.ba_analysis = JSON.stringify(result);

  params.customParams = custom;
  root.params = params;

  return encodeURIComponent(JSON.stringify(root));
}

