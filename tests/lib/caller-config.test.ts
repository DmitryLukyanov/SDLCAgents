/**
 * Run: npx tsx tests/lib/caller-config.test.ts
 */
import assert from 'node:assert/strict';
import { isParentAsyncChildResumeCallerConfig, type CallerConfigRoot } from '../../src/lib/caller-config.js';

function run(): void {
  // Returns false when async_child_run_id is absent
  assert.equal(isParentAsyncChildResumeCallerConfig({ params: {} }), false);
  assert.equal(isParentAsyncChildResumeCallerConfig({}), false);

  // Returns false when async_child_run_id is empty / whitespace
  assert.equal(isParentAsyncChildResumeCallerConfig({ params: { async_child_run_id: '' } }), false);
  assert.equal(isParentAsyncChildResumeCallerConfig({ params: { async_child_run_id: '   ' } }), false);

  // Returns false for unevaluated GHA expression placeholders
  const placeholders = [
    '${{ github.run_id }}',
    '${{steps.dispatch.outputs.run_id}}',
    '${{ steps.X.outputs.child_run_id }}',
    '  ${{ foo }}  ',
  ];
  for (const ph of placeholders) {
    const root: CallerConfigRoot = { params: { async_child_run_id: ph } };
    assert.equal(
      isParentAsyncChildResumeCallerConfig(root),
      false,
      `Expected false for placeholder: ${ph}`,
    );
  }

  // Returns true for a real numeric run id
  assert.equal(
    isParentAsyncChildResumeCallerConfig({ params: { async_child_run_id: '12345678' } }),
    true,
  );

  // Returns true for any non-placeholder non-empty string
  assert.equal(
    isParentAsyncChildResumeCallerConfig({ params: { async_child_run_id: 'some-run-id' } }),
    true,
  );

  console.log('caller-config tests: ok');
}

run();
