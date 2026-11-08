import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainAssessment, exposureForMinutes, parseIds } from '../src/assessmentInsights.ts';

const edges = [
  { dependencyId: 'MS-DEP-1', parentComponentId: 'chiller1', childComponentId: 'pump' },
  { dependencyId: 'MS-DEP-2', parentComponentId: 'chiller2', childComponentId: 'pump' },
  { dependencyId: 'MS-DEP-3', parentComponentId: 'pump', childComponentId: 'hall' },
];
const rules = edges.map((edge, index) => ({ dependencyId: edge.dependencyId, requirementGroup: index < 2 ? 'cooling-supply' : 'hall-cooling', relationshipType: 'COOLING' }));

test('explains backup protection without marking a protected child disrupted', () => {
  const result = explainAssessment('chiller1', [], edges, rules);
  assert.equal(result.disrupted.length, 0);
  assert.deepEqual(result.protected[0].survivingSources, ['chiller2']);
});

test('explains a shared pump failure and never counts the root as downstream', () => {
  const result = explainAssessment('pump', ['hall'], edges, rules);
  assert.deepEqual(result.disrupted.map(group => group.child), ['hall']);
  assert.equal(result.protected.length, 0);
});

test('does not call an asset protected when another requirement has already failed', () => {
  const result = explainAssessment('chiller1', ['pump', 'hall'], edges, rules);
  assert.equal(result.protected.length, 0);
  assert.deepEqual(result.disrupted.map(group => group.child), ['hall']);
});

test('rejects incomplete dependency rules and malformed persisted data', () => {
  assert.throws(() => explainAssessment('pump', ['hall'], edges, []), /Missing dependency/);
  assert.throws(() => parseIds('[1]'), /invalid identifiers/);
  assert.throws(() => parseIds('{}'), /invalid identifiers/);
  assert.deepEqual(parseIds('["a","a","b"]'), ['a', 'b']);
});

test('prorates fictional hourly exposure and rejects invalid financial inputs', () => {
  assert.equal(exposureForMinutes(29000, 15), 7250);
  assert.equal(exposureForMinutes(29000, 60), 29000);
  assert.equal(exposureForMinutes(0, 240), 0);
  assert.throws(() => exposureForMinutes(-1, 60));
  assert.throws(() => exposureForMinutes(29000, NaN));
  assert.throws(() => exposureForMinutes(29000, 241));
});
