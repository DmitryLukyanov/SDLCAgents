/**
 * llm_evaluate runner.
 *
 * Fetches the Jira issue (summary, description, comments) and related issues,
 * runs LLM analysis via analyzeTicket(), and stores the outcome in the pipeline context.
 */
import {
  extractComments,
  mapRelated,
  printInputTicketSummary,
  buildInputTicketSummaryMarkdown,
  appendGithubStepSummary,
  INPUT_SUMMARY_LIMITS,
  previewForLog,
  type BusinessAnalystContext,
} from '../business-analyst-core.js';
import type { RelatedIssueSummary } from '../../../lib/jira/jira-related.js';
import type { BaAnalysisResult } from '../ba-types.js';
import type { BaPipelineContext, BaPipelineDeps, BaStepOutcome } from '../ba-runner-types.js';

export async function runLlmEvaluate(
  ctx: BaPipelineContext,
  deps: BaPipelineDeps,
  baCtx: BusinessAnalystContext,
): Promise<BaStepOutcome> {
  const { issueKey } = ctx;

  // ── Fetch Jira data ──────────────────────────────────────────────
  console.log('\n── Fetching Jira data (summary, description, comments) ──');
  const issue = await deps.getIssue(issueKey, ['summary', 'description', 'comment']);
  const fields = issue.fields;
  const { adfToPlain } = await import('../../../lib/adf-to-plain.js');
  const summary = fields?.summary?.trim() || '(no summary)';
  const description = adfToPlain(fields?.description);
  const comments = extractComments(fields);

  console.log(`   Summary: ${summary.slice(0, 80)}${summary.length > 80 ? '...' : ''}`);
  console.log(`   Description: ${description ? `${description.length} chars` : '(empty)'}`);
  console.log(`   Comments: ${comments.length}`);

  // ── Fetch related issues ─────────────────────────────────────────
  console.log('\n── Fetching related issues ──');
  let related: RelatedIssueSummary[] = [];
  if (baCtx.ticketContextDepth >= 1) {
    try {
      related = await deps.fetchRelatedIssueSummaries(issueKey, baCtx.ticketContextDepth);
      console.log(`   Found ${related.length} related issue(s)`);
    } catch (e) {
      console.warn('   ⚠️ Could not fetch related issues (non-fatal):', e);
    }
  } else {
    console.log('   Skipped (depth = 0)');
  }

  // ── Analyze with LLM ────────────────────────────────────────────
  console.log('\n── Analyzing ticket content via GitHub Models API ──');
  const ticketCtx = {
    issueKey,
    summary,
    description,
    comments,
    relatedIssues: mapRelated(related),
  };

  printInputTicketSummary(ticketCtx);
  await appendGithubStepSummary(buildInputTicketSummaryMarkdown(ticketCtx));

  const outcome = await deps.analyzeTicket(ticketCtx, deps.githubToken, baCtx.model);

  // ── Print extraction summary ─────────────────────────────────────
  const analysisResult = outcome.status === 'complete'
    ? outcome.result
    : outcome.partialResult ?? null;

  if (analysisResult) {
    console.log('\n── Extraction Summary ──');
    const resultFields: Array<{ key: keyof BaAnalysisResult; label: string }> = [
      { key: 'specifyInput', label: 'Specify (what & why)' },
      { key: 'clarifyInput', label: 'Clarify (ambiguities)' },
      { key: 'planInput', label: 'Plan (technical design)' },
      { key: 'tasksInput', label: 'Tasks (work items)' },
      { key: 'implementInput', label: 'Implement (code/artifacts)' },
    ];
    for (const f of resultFields) {
      const value = analysisResult[f.key];
      if (value) {
        const preview = previewForLog(value, INPUT_SUMMARY_LIMITS.summary);
        console.log(`   ✅ ${f.label}:`);
        console.log(`      ${preview}`);
      } else {
        console.log(`   ❌ ${f.label}: NOT FOUND`);
      }
    }
  }

  ctx.outcome = outcome;
  return { status: 'continue' };
}
