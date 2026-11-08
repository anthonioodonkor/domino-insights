import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResponsePlan, nextResponseStep } from '../src/responsePlan.ts';

test('shared-pump guidance coordinates downstream services without inventing failover', () => {
  const plan = buildResponsePlan({ componentId: 'MS-PUMP-1', assetName: 'Pump', domain: 'HVAC', affectedServices: ['Hall A'], affectedTenants: ['Atlas'] });
  assert.match(plan[1].task, /does not bypass/);
  assert.match(plan[2].task, /Hall A/);
  assert.match(plan[2].task, /Atlas/);
  assert.match(plan[3].task, /Do not choose cooling failover/);
  assert.match(plan[4].task, /after both approval and the latest fault/);
});

test('operator next step follows recorded state and invalidates stale approval', () => {
  assert.match(nextResponseStep(), /Create the simulated response/);
  assert.match(nextResponseStep('incident'), /Acknowledge/);
  assert.match(nextResponseStep('incident', 'ACKNOWLEDGED'), /record approval/);
  assert.match(nextResponseStep('incident', 'APPROVED', 10, 20), /reapprove/);
  assert.match(nextResponseStep('incident', 'APPROVED', 20, 10), /fresh synthetic/);
  assert.match(nextResponseStep('incident', 'RESOLVED'), /recorded as resolved/);
});
