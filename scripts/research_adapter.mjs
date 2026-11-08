// Offline adapter only. Source files are immutable inputs; no database transport.
export const COMPONENT_MAPPING = Object.freeze({ 'COMP-CH-01': 'MS-CHILLER-1' });

export function parseResearchCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  if (header !== 'reading_id,component_id,metric_name,value,timestamp') {
    throw new Error('Unexpected research CSV header');
  }
  // The normalized contract contains no quoted fields. Reject rather than misparse them.
  return lines.map(line => {
    const fields = line.split(',');
    if (fields.length !== 5 || line.includes('"') || fields.some(v => !v.trim())) {
      throw new Error('Invalid normalized CSV row');
    }
    const [reading_id, component_id, metric_name, value, timestamp] = fields;
    return { reading_id, component_id, metric_name, value: Number(value), timestamp: Number(timestamp) };
  });
}

export function prepareResearchSequence(rows, provenance, annotations, sequenceId) {
  const sequence = annotations.sequences.find(s => s.sequence_id === sequenceId);
  if (!sequenceId || !sequence) throw new Error('Select one known research sequence with --sequence');
  if (provenance.source_kind !== 'research_simulation' ||
      provenance.source_id !== annotations.source_id ||
      provenance.sample_interval_seconds !== 60 ||
      provenance.timestamp.assumed_offset !== sequence.timestamp_assumed_offset) {
    throw new Error('Inconsistent research provenance');
  }
  const selected = rows.filter(row => row.reading_id.startsWith(sequenceId + '-'));
  if (selected.length !== sequence.reading_count) throw new Error('Incomplete research sequence');
  const ids = new Set();
  const samples = new Map();
  const output = selected.map(row => {
    const target = Object.hasOwn(COMPONENT_MAPPING, row.component_id) && COMPONENT_MAPPING[row.component_id];
    const metric = Object.hasOwn(provenance.metrics, row.metric_name) && provenance.metrics[row.metric_name];
    if (!target) throw new Error('Unmapped research component: ' + row.component_id);
    if (!metric || !Number.isFinite(row.value) || !Number.isSafeInteger(row.timestamp) ||
        ids.has(row.reading_id) || (row.metric_name === 'chiller_on' && ![0, 1].includes(row.value))) {
      throw new Error('Invalid or duplicate research reading: ' + row.reading_id);
    }
    ids.add(row.reading_id);
    const metrics = samples.get(row.timestamp) ?? new Set();
    if (metrics.has(row.metric_name)) throw new Error('Duplicate metric at research timestamp');
    metrics.add(row.metric_name);
    samples.set(row.timestamp, metrics);
    return {
      ...row, component_id: target,
      source_kind: 'research_simulation', is_live: false, sequence_id: sequenceId,
      provenance: {
        source_reading: { ...row },
        source_metadata: structuredClone(provenance),
        source_sequence: structuredClone(sequence),
        mapping: { source_component_id: row.component_id, target_component_id: target },
        timestamp_verification: 'unverified_fixed_offset',
      },
    };
  });
  const times = [...samples.keys()].sort((a, b) => a - b);
  if (times.length !== sequence.source_row_count || times.some((time, index) =>
    samples.get(time).size !== Object.keys(provenance.metrics).length ||
    (index > 0 && time - times[index - 1] !== 60_000)) ||
    times[0] !== Date.parse(sequence.source_datetime_start + sequence.timestamp_assumed_offset) ||
    times.at(-1) !== Date.parse(sequence.source_datetime_end_inclusive + sequence.timestamp_assumed_offset)) {
    throw new Error('Research sample cadence, bounds, or metric coverage mismatch');
  }
  return output.sort((a, b) => a.timestamp - b.timestamp || a.reading_id.localeCompare(b.reading_id));
}
