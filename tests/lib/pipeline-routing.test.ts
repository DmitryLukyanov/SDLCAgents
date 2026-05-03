/**
 * Run: npx tsx tests/lib/pipeline-routing.test.ts
 */
import assert from 'node:assert/strict';
import {
  findFirstAsyncCallStepIndex,
  findFirstEnabledAsyncCallStepIndex,
  normalizePipelineStepIds,
  parseAgentPipelineSteps,
} from '../../src/lib/pipeline-config.js';
import {
  getPipelineStartIndex,
  getPipelineStartIndexFromCallerRoot,
} from '../../src/lib/pipeline-expected-step-helper.js';
import { decodeCallerConfig, encodeCallerConfig, type CallerConfigRoot } from '../../src/lib/caller-config.js';
import {
  mergeCallerConfigForAsyncChildDispatch,
  mergeCallerConfigForParentResumeAfterAsync,
} from '../../src/lib/pipeline-callback-config.js';

const sampleConfig = JSON.stringify({
  name: 'x',
  params: {
    runner: 'pipeline',
    steps: [
      { runner: 'a' },
      { id: 'mid', runner: 'b', async_call: { workflowFile: 'child.yml' } },
      { runner: 'c' },
    ],
  },
});

function run(): void {
  const steps = parseAgentPipelineSteps(sampleConfig, 'sample');
  assert.equal(steps[0].id, 'a#0');
  assert.equal(steps[1].id, 'mid');
  assert.equal(findFirstAsyncCallStepIndex(steps), 1);
  assert.equal(findFirstEnabledAsyncCallStepIndex(steps), 1);

  const disabledAsync = normalizePipelineStepIds([
    { runner: 'a' },
    { id: 'x', runner: 'b', enabled: false, async_call: { workflowFile: 'w.yml' } },
  ]);
  assert.equal(findFirstEnabledAsyncCallStepIndex(disabledAsync), -1);

  assert.equal(getPipelineStartIndex(steps, undefined), 0);
  assert.equal(getPipelineStartIndex(steps, { asyncTriggerStepId: 'mid' }), 2);

  const root: CallerConfigRoot = {
    params: { inputJql: 'key = P-1', async_trigger_step: 'mid' },
  };
  assert.equal(getPipelineStartIndexFromCallerRoot(steps, root), 2);

  const base = encodeCallerConfig({ params: { inputJql: 'key = X-1' } });
  const merged = mergeCallerConfigForAsyncChildDispatch(base, {
    callback: 'p.yml',
    async_trigger_step: 's1',
    parent_run_url: 'u',
    parent_run_id: '1',
  });
  const round = decodeCallerConfig(merged);
  assert.equal(round.params?.callback, 'p.yml');
  assert.equal(round.params?.async_trigger_step, 's1');

  const resumed = mergeCallerConfigForParentResumeAfterAsync(merged, '42');
  assert.equal(decodeCallerConfig(resumed).params?.async_child_run_id, '42');

  console.log('pipeline-routing tests: ok');
}

run();
