import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseResearchCsv, prepareResearchSequence } from './research_adapter.mjs';

const read = name => readFileSync(new URL('../data/processed/' + name, import.meta.url), 'utf8');
const rows = parseResearchCsv(read('hvac_readings.csv'));
const provenance = JSON.parse(read('hvac_provenance.json'));
const annotations = JSON.parse(read('hvac_fault_annotations.json'));
const prepare = (input = rows, sequence = 'LBNL-2E91') => prepareResearchSequence(input, provenance, annotations, sequence);

test('maps both histories separately, preserving source IDs, timestamps, and provenance', () => {
  const before = JSON.stringify({ rows, provenance, annotations });
  for (const sequence of annotations.sequences) {
    const output = prepare(rows, sequence.sequence_id);
    assert.equal(output.length, 480);
    assert.equal(new Set(output.map(r => r.timestamp)).size, 120);
    for (const row of output) {
      assert.equal(row.component_id, 'MS-CHILLER-1');
      assert.equal(row.provenance.source_reading.component_id, 'COMP-CH-01');
      assert.equal(row.timestamp, row.provenance.source_reading.timestamp);
      assert.equal(row.source_kind, 'research_simulation');
      assert.equal(row.is_live, false);
      assert.equal(row.sequence_id, sequence.sequence_id);
      assert.deepEqual(row.provenance.source_metadata, provenance);
    }
  }
  assert.equal(JSON.stringify({ rows, provenance, annotations }), before);
});

test('requires an explicit known sequence', () => {
  assert.throws(() => prepare(rows, ''), /Select one/);
  assert.throws(() => prepare(rows, 'all'), /Select one/);
});

test('rejects unmapped assets, invalid numbers, duplicate readings and incomplete samples', () => {
  const mutate = patch => rows.map((row, i) => i === 0 ? { ...row, ...patch } : row);
  assert.throws(() => prepare(mutate({ component_id: 'UNKNOWN' })), /Unmapped/);
  assert.throws(() => prepare(mutate({ value: NaN })), /Invalid/);
  assert.throws(() => prepare([...rows, rows[0]]), /Incomplete/);
  assert.throws(() => prepare(rows.slice(1)), /Incomplete/);
  assert.throws(() => prepare(mutate({ timestamp: rows[0].timestamp + 1 })), /cadence/);
  assert.throws(() => parseResearchCsv('reading_id,component_id,metric_name,value,timestamp\nx,y,z,,1'), /Invalid/);
});
