/**
 * Job summary (`GITHUB_STEP_SUMMARY`): markdown + console from flexible segments.
 *
 * - **String segment** — printed to stdout as-is; included in markdown verbatim (trimmed per block).
 * - **Table segment** — ASCII table on console; GitHub markdown pipe table for the step summary file.
 */
import { appendFile } from 'node:fs/promises';

export interface SummaryTableSegment {
  readonly kind: 'table';
  headers: string[];
  rows: string[][];
}

export type JobSummarySegment = string | SummaryTableSegment;

export function isSummaryTableSegment(s: JobSummarySegment): s is SummaryTableSegment {
  return typeof s === 'object' && s !== null && (s as SummaryTableSegment).kind === 'table';
}

function escapeMarkdownTableCell(value: string): string {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

/** Build markdown for `GITHUB_STEP_SUMMARY`. */
export function renderJobSummaryMarkdown(segments: JobSummarySegment[]): string {
  const blocks: string[] = [];
  for (const seg of segments) {
    if (typeof seg === 'string') {
      blocks.push(seg.trimEnd());
    } else if (isSummaryTableSegment(seg)) {
      const { headers, rows } = seg;
      if (headers.length === 0) continue;
      // GFM tables require consecutive rows separated by a single newline; blank lines
      // between header / separator / body break parsing (e.g. GitHub Actions job summary).
      const tableMd = [
        '| ' + headers.map((h) => escapeMarkdownTableCell(String(h))).join(' | ') + ' |',
        '| ' + headers.map(() => '---').join(' | ') + ' |',
        ...rows.map((row) => {
          const cells = headers.map((_, i) => escapeMarkdownTableCell(String(row[i] ?? '')));
          return '| ' + cells.join(' | ') + ' |';
        }),
      ].join('\n');
      blocks.push(tableMd);
    }
  }
  return blocks.join('\n\n') + '\n';
}

/** Box-drawing ASCII table for terminal output. */
export function formatAsciiTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';
  const normalizedRows = rows.map((r) => headers.map((_, i) => String(r[i] ?? '')));
  const allRows = [headers.map(String), ...normalizedRows];
  const widths = headers.map((_, j) => Math.max(...allRows.map((row) => (row[j] ?? '').length)));
  const top = '┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
  const sep = '├' + widths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤';
  const bot = '└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';
  const fmtRow = (cells: string[]) =>
    '│ ' + cells.map((c, i) => String(c).padEnd(widths[i]!)).join(' │ ') + ' │';
  const lines = [
    top,
    fmtRow(headers.map(String)),
    sep,
    ...normalizedRows.map((r) => fmtRow(headers.map((_, i) => r[i] ?? ''))),
    bot,
  ];
  return lines.join('\n');
}

/** Print segments to stdout (strings verbatim; tables as ASCII). */
export function printJobSummaryToConsole(segments: JobSummarySegment[]): void {
  for (const seg of segments) {
    if (typeof seg === 'string') {
      console.log(seg);
    } else if (isSummaryTableSegment(seg)) {
      console.log(formatAsciiTable(seg.headers, seg.rows));
    }
  }
}

/** Append markdown to `GITHUB_STEP_SUMMARY` when set (non-fatal on failure). */
export async function appendGithubJobSummary(markdown: string): Promise<void> {
  const stepSummary = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (!stepSummary) return;
  try {
    await appendFile(stepSummary, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
  } catch (e) {
    console.warn('Could not append to GITHUB_STEP_SUMMARY (non-fatal):', e);
  }
}

/** Console output + job summary file from the same segments. */
export async function publishJobSummary(segments: JobSummarySegment[]): Promise<void> {
  printJobSummaryToConsole(segments);
  await appendGithubJobSummary(renderJobSummaryMarkdown(segments));
}
