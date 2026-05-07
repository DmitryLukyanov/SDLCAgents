import assert from 'node:assert/strict';
import {
  assertTerminalMatchesPipelineChildWorkflow,
} from '../../src/lib/workflow-dispatch-inputs-registry.js';
import {
  buildAsyncChildWorkflowDispatchInputs,
  mergeAsyncCallInputsForTargetWorkflow,
} from '../../src/lib/routing_helper.js';

assertTerminalMatchesPipelineChildWorkflow('business-analyst.yml', false, 'cfg');
assertTerminalMatchesPipelineChildWorkflow('speckit-developer-agent.yml', true, 'cfg');

let t = false;
try {
  assertTerminalMatchesPipelineChildWorkflow('business-analyst.yml', true, 'my.config');
} catch (e) {
  t = true;
  assert.ok(e instanceof Error);
  assert.match((e as Error).message, /terminal to false/i);
}
assert.ok(t);

t = false;
try {
  assertTerminalMatchesPipelineChildWorkflow('speckit-developer-agent.yml', false, 'my.config');
} catch (e) {
  t = true;
  assert.ok(e instanceof Error);
  assert.match((e as Error).message, /terminal to true/i);
}
assert.ok(t);

const speckitInputs = buildAsyncChildWorkflowDispatchInputs({
  workflowFile: 'speckit-developer-agent.yml',
  terminal: true,
  configLabel: 'x',
  concurrencyKey: 'k',
  configFile: 'c',
  callerConfigEncoded: 'e',
  handoffIssueKey: 'ISS-1',
  handoffGithubIssueNumber: '42',
  standaloneDefaultStep: 'plan',
  asyncCallInputs: { step: 'tasks' },
});
assert.equal(speckitInputs.step, 'tasks');
assert.ok(!('concurrency_key' in speckitInputs));
assert.ok(!('caller_config' in speckitInputs));

const baInputs = buildAsyncChildWorkflowDispatchInputs({
  workflowFile: 'business-analyst.yml',
  terminal: false,
  configLabel: 'x',
  concurrencyKey: 'k',
  configFile: 'c',
  callerConfigEncoded: 'encoded',
  handoffIssueKey: 'ISS-1',
  handoffGithubIssueNumber: '42',
  standaloneDefaultStep: 'specify',
  asyncCallInputs: undefined,
});
assert.equal(baInputs.concurrency_key, 'k');
assert.equal(baInputs.caller_config, 'encoded');

t = false;
try {
  buildAsyncChildWorkflowDispatchInputs({
    workflowFile: 'speckit-developer-agent.yml',
    terminal: true,
    configLabel: 'cfg',
    concurrencyKey: 'k',
    configFile: 'c',
    callerConfigEncoded: 'e',
    handoffIssueKey: 'ISS-1',
    handoffGithubIssueNumber: '42',
    standaloneDefaultStep: 'plan',
    asyncCallInputs: { concurrency_key: 'bad' },
  });
} catch (e) {
  t = true;
  assert.ok(e instanceof Error);
  assert.match((e as Error).message, /async_call\.inputs\.concurrency_key/);
}
assert.ok(t);

const proceedBase: Record<string, string> = { pr_number: '' };
mergeAsyncCallInputsForTargetWorkflow(
  'speckit-developer-agent-proceed.yml',
  proceedBase,
  { pr_number: '99' },
  'cfg',
);
assert.equal(proceedBase.pr_number, '99');

console.log('async-child-dispatch tests OK');
