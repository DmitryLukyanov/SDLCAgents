import assert from 'node:assert/strict';
import {
  assertWorkflowDispatchInputsAllowed,
  WorkflowDispatchInputValidationError,
} from '../../src/lib/workflow-dispatch-validate.js';

assertWorkflowDispatchInputsAllowed('speckit-developer-agent.yml', {
  mode: 'speckit',
  issue_number: '1',
  issue_key: 'X-1',
  step: 'specify',
  branch_name: '',
  pr_number: '',
  prompt: '',
});

let threw = false;
try {
  assertWorkflowDispatchInputsAllowed('speckit-developer-agent.yml', {
    mode: 'speckit',
    issue_key: 'X-1',
    config_file: 'nope.config',
  } as Record<string, string>);
} catch (e) {
  threw = true;
  assert.ok(e instanceof WorkflowDispatchInputValidationError);
  const err = e as WorkflowDispatchInputValidationError;
  assert.ok(err.rejectedKeys.includes('config_file'));
}
assert.ok(threw);

console.log('workflow-dispatch-validate tests OK');
