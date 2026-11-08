// Local dry-run transport. The reducer transport requires Developer 2's approved contract.
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { parseResearchCsv, prepareResearchSequence } from './research_adapter.mjs';

type Reading = {
  reading_id: string;
  component_id: string;
  metric_name: string;
  value: number;
  timestamp: number;
};
type Phase = { phase: string; start_minute: number; end_minute_exclusive: number };

async function main() {
  const { values } = parseArgs({ options: {
    speed: { type: 'string', default: '0' },
    phase: { type: 'string' },
    source: { type: 'string', default: 'scenario' },
    sequence: { type: 'string' },
  } });
  const speed = Number(values.speed);
  if (!values.speed?.trim() || !Number.isFinite(speed) || speed < 0) {
    throw new Error('--speed must be a finite nonnegative number');
  }
  if (!['scenario', 'research'].includes(values.source!)) throw new Error('--source must be scenario or research');
  if (values.source === 'research' && values.phase !== undefined) throw new Error('--phase applies only to scenarios');
  if (values.source === 'scenario' && values.sequence !== undefined) throw new Error('--sequence applies only to research');
  let rows: Reading[];
  if (values.source === 'research') {
    const read = (file: string) => readFile(new URL('../data/processed/' + file, import.meta.url), 'utf8');
    rows = prepareResearchSequence(
      parseResearchCsv(await read('hvac_readings.csv')),
      JSON.parse(await read('hvac_provenance.json')),
      JSON.parse(await read('hvac_fault_annotations.json')),
      values.sequence,
    );
  } else {
  const scenario = JSON.parse(await readFile(new URL('../data/scenarios/cooling_cascade.json', import.meta.url), 'utf8')) as {
    timestamp_start: number; phases: Phase[]; telemetry: Reading[];
  };
  const phase = scenario.phases.find((entry) => entry.phase === values.phase);
  if (values.phase !== undefined && !phase) throw new Error('--phase must be normal, fault, or recovery');
  const start = phase ? scenario.timestamp_start + phase.start_minute * 60_000 : -Infinity;
  const end = phase ? scenario.timestamp_start + phase.end_minute_exclusive * 60_000 : Infinity;
  rows = scenario.telemetry.filter((row) => start <= row.timestamp && row.timestamp < end)
    .map(row => ({ ...row, source_kind: 'synthetic', is_live: false }));
  }
  rows.sort((a, b) => a.timestamp - b.timestamp || a.reading_id.localeCompare(b.reading_id));
  if (!rows.length) throw new Error('No matching telemetry');
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.reading_id !== 'string' || !row.reading_id ||
        typeof row.component_id !== 'string' || !row.component_id ||
        typeof row.metric_name !== 'string' || !row.metric_name ||
        !Number.isFinite(row.value) || !Number.isSafeInteger(row.timestamp) ||
        ids.has(row.reading_id)) throw new Error('Invalid or duplicate row ' + row.reading_id);
    ids.add(row.reading_id);
  }
  let previous = rows[0].timestamp;
  for (const row of rows) {
    if (speed > 0 && row.timestamp > previous) {
      const delay = (row.timestamp - previous) / speed;
      if (delay > 2_147_483_647) throw new Error('--speed is too low for the sample interval');
      if (delay >= 1) await setTimeout(delay);
    }
    if (!process.stdout.write(JSON.stringify(row) + '\n')) await once(process.stdout, 'drain');
    previous = row.timestamp;
  }
  console.error('Dry run emitted ' + rows.length + ' telemetry rows.');
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
