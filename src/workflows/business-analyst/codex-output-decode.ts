import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

function isZip(buf: Buffer): boolean {
  // ZIP local file header: "PK\x03\x04"
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

function isGzip(buf: Buffer): boolean {
  // GZIP header: 1F 8B
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/**
 * Codex output should be plain text JSON, but when the wrong artifact gets wired
 * (e.g., a zipped log bundle), the file begins with the ZIP signature "PK\x03\x04".
 *
 * We can't reliably extract zip contents without an extra dependency, so we detect
 * it and return an empty string. That forces the BA parser down the "incomplete"
 * path and avoids leaving the Jira ticket stuck InProgress.
 */
export function decodeCodexOutputBestEffort(absPath: string, logPrefix = '[codex-output]'): string {
  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch {
    console.warn(`${logPrefix} Missing or unreadable Codex output: ${absPath}`);
    return '';
  }

  if (isZip(buf)) {
    console.warn(
      `${logPrefix} Codex output is a ZIP file (PK\\x03\\x04). Expected plain text JSON. Treating as empty output.`,
    );
    return '';
  }

  if (isGzip(buf)) {
    try {
      console.warn(`${logPrefix} Codex output is gzip-compressed; decompressing.`);
      return gunzipSync(buf).toString('utf8');
    } catch (e) {
      console.warn(`${logPrefix} Failed to gunzip Codex output (non-fatal):`, e);
      return '';
    }
  }

  return buf.toString('utf8');
}

