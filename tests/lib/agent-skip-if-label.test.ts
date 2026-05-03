import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeSkipIfLabelReason,
  evaluateSkipIfLabel,
  evaluateSkipIfLabelFromConfigFile,
  formatSkipIfLabelHitReason,
  parseSkipIfLabelFromAgentJson,
  parseSkipIfLabelFromConfigFile,
} from '../../src/lib/agent-skip-if-label.js';

function ok(name: string): void {
  console.log(`  ok: ${name}`);
}

async function main(): Promise<void> {
  assert.equal(parseSkipIfLabelFromAgentJson(null), '');
  ok('parse null');

  assert.equal(parseSkipIfLabelFromAgentJson({ params: { skipIfLabel: '  x  ' } }), 'x');
  ok('parse root trim');

  assert.equal(parseSkipIfLabelFromAgentJson({ params: { ba: { skipIfLabel: 'ignored' } } }), '');
  ok('parse ignores nested ba');

  assert.equal(parseSkipIfLabelFromAgentJson({ params: { skipIfLabel: 'root', ba: { skipIfLabel: 'ignored' } } }), 'root');
  ok('parse root skipIfLabel only');

  assert.equal(computeSkipIfLabelReason('', ['a']), '');
  assert.equal(computeSkipIfLabelReason('x', ['a', 'b']), '');
  assert.equal(computeSkipIfLabelReason('x', ['x']), formatSkipIfLabelHitReason('x'));
  assert.equal(formatSkipIfLabelHitReason('a b'), 'already_labelled_a_b');
  ok('compute + format');

  const r = await evaluateSkipIfLabel({
    agentJson: { params: { skipIfLabel: 'gate' } },
    issueKey: 'K-1',
    fetchIssueLabelNames: async () => ['gate', 'other'],
  });
  assert.equal(r.skipIfLabel, 'gate');
  assert.equal(r.skipReason, formatSkipIfLabelHitReason('gate'));
  ok('evaluate hit');

  const r2 = await evaluateSkipIfLabel({
    agentJson: { params: { skipIfLabel: 'gate' } },
    issueKey: 'K-1',
    fetchIssueLabelNames: async () => ['other'],
  });
  assert.equal(r2.skipReason, '');
  ok('evaluate miss');

  const r3 = await evaluateSkipIfLabel({
    agentJson: { params: {} },
    issueKey: 'K-1',
    fetchIssueLabelNames: async () => {
      throw new Error('should not fetch when no skipIfLabel');
    },
  });
  assert.equal(r3.skipReason, '');
  ok('evaluate no gate skips fetch');

  const dir = mkdtempSync(join(tmpdir(), 'sdlc-skip-if-'));
  try {
    writeFileSync(join(dir, 'agent.config'), JSON.stringify({ params: { skipIfLabel: 'L1' } }));
    assert.equal(await parseSkipIfLabelFromConfigFile('agent.config', dir), 'L1');
    ok('parseSkipIfLabelFromConfigFile');

    const fromFile = await evaluateSkipIfLabelFromConfigFile({
      configFilePath: 'agent.config',
      issueKey: 'X-1',
      cwd: dir,
      fetchIssueLabelNames: async () => ['L1'],
    });
    assert.equal(fromFile.skipReason, formatSkipIfLabelHitReason('L1'));
    ok('evaluateSkipIfLabelFromConfigFile hit');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('agent-skip-if-label tests: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
