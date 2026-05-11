/**
 * Run: npx tsx tests/lib/pipeline-run-if.test.ts
 */
import assert from 'node:assert/strict';
import type { PipelineStepConfig } from '../../src/lib/pipeline-config.js';
import { shouldRunPipelineStepByRunIf } from '../../src/lib/pipeline-run-if.js';

function run(): void {
  const sync: PipelineStepConfig = { id: 's', runner: 'stop_pipeline', runIf: 'ba_incomplete' };
  assert.equal(shouldRunPipelineStepByRunIf(sync, {}).execute, false);
  assert.equal(shouldRunPipelineStepByRunIf(sync, { baOutcome: { status: 'complete' } }).execute, false);
  assert.equal(shouldRunPipelineStepByRunIf(sync, { baOutcome: { status: 'incomplete' } }).execute, true);

  const asyncStep: PipelineStepConfig = {
    id: 'ba_async',
    runner: 'async_operation',
    runIf: 'ba_incomplete',
    async_call: { workflowFile: 'x.yml' },
  };
  assert.equal(shouldRunPipelineStepByRunIf(asyncStep, {}).execute, true, 'async_call ignores runIf');

  assert.throws(() => shouldRunPipelineStepByRunIf({ id: 'z', runner: 'r', runIf: 'nope' }, {}), /Unknown pipeline runIf/);

  const stopIfIncomplete: PipelineStepConfig = {
    id: 'x',
    runner: 'stop_pipeline',
    runIf: 'ba_async.output.completed = false',
  };
  assert.equal(
    shouldRunPipelineStepByRunIf(stopIfIncomplete, {
      asyncStepOutputById: { ba_async: { output: { completed: false, baStatus: 'incomplete' } } },
    }).execute,
    true,
  );
  assert.equal(
    shouldRunPipelineStepByRunIf(stopIfIncomplete, {
      asyncStepOutputById: { ba_async: { output: { completed: true, baStatus: 'complete' } } },
    }).execute,
    false,
  );
  assert.equal(
    shouldRunPipelineStepByRunIf(
      { id: 'y', runner: 'r', runIf: 'ba_async.output.completed = true' },
      { asyncStepOutputById: { ba_async: { output: { completed: true } } } },
    ).execute,
    true,
  );
  assert.equal(
    shouldRunPipelineStepByRunIf(
      { id: 'y', runner: 'r', runIf: 'ba_async.output.completed = true' },
      { asyncStepOutputById: { ba_async: { output: { completed: false } } } },
    ).execute,
    false,
  );
  assert.equal(
    shouldRunPipelineStepByRunIf(
      { id: 'y', runner: 'r', runIf: 'ba_async.output.baStatus = null' },
      { asyncStepOutputById: { ba_async: { output: { baStatus: null } } } },
    ).execute,
    true,
  );

  assert.throws(
    () => shouldRunPipelineStepByRunIf({ id: 'y', runner: 'stop_pipeline', runIf: 'ba_async.output.completed = false' }, {}),
    /requires async output envelope/,
  );
}

run();
console.log('pipeline-run-if tests: ok');
