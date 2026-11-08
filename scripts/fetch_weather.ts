import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object from Open-Meteo');
  }
  return value as JsonObject;
}

const requested_location = { latitude: 32.7767, longitude: -96.7970 };
const source_url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: String(requested_location.latitude),
  longitude: String(requested_location.longitude),
  current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
  timezone: 'GMT',
  temperature_unit: 'celsius',
  wind_speed_unit: 'kmh',
});
const metrics = [
  ['temperature_2m', 'outdoor_temp_c', '°C', 'Cel'],
  ['relative_humidity_2m', 'outdoor_relative_humidity_pct', '%', '%'],
  ['wind_speed_10m', 'outdoor_wind_speed_kmh', 'km/h', 'km/h'],
] as const;

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid ' + field);
  return value;
}

async function main() {
  const response = await fetch(source_url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('Open-Meteo HTTP ' + response.status);
  const raw_response = object(await response.json());
  const retrieved_at = new Date().toISOString();
  const current = object(raw_response.current);
  const units = object(raw_response.current_units);
  const time = current.time;
  if (raw_response.utc_offset_seconds !== 0 || units.time !== 'iso8601' ||
      typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) {
    throw new Error('Invalid UTC timestamp from Open-Meteo');
  }
  const timestamp = Date.parse(time + 'Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 16) !== time ||
      timestamp > Date.parse(retrieved_at)) {
    throw new Error('Invalid weather observation time');
  }
  const sampling_interval_seconds = finite(current.interval, 'interval');
  if (!Number.isInteger(sampling_interval_seconds) || sampling_interval_seconds <= 0 ||
      units.interval !== 'seconds') {
    throw new Error('Invalid weather interval');
  }
  const signals = metrics.map(([source_field, metric_name, sourceUnit, unit]) => {
    if (units[source_field] !== sourceUnit) throw new Error('Unexpected unit for ' + source_field);
    const value = finite(current[source_field], source_field);
    if ((source_field === 'relative_humidity_2m' && (value < 0 || value > 100)) ||
        (source_field === 'wind_speed_10m' && value < 0)) {
      throw new Error('Out-of-range ' + source_field);
    }
    return { metric_name, value, unit, source_field };
  });
  const snapshot = {
    schema_version: '1.0', source_id: 'open_meteo', source_kind: 'external_model_estimate',
    attribution: 'Weather data by Open-Meteo.com', license: 'CC BY 4.0', source_url,
    requested_location, model_grid_location: {
      latitude: finite(raw_response.latitude, 'latitude'),
      longitude: finite(raw_response.longitude, 'longitude'),
    },
    observed_at: new Date(timestamp).toISOString(), timestamp, retrieved_at,
    sampling_interval_seconds, signals, raw_response,
  };
  const output = process.argv[2] ? resolve(process.argv[2]) :
    fileURLToPath(new URL('../data/snapshots/weather_snapshot.json', import.meta.url));
  await mkdir(dirname(output), { recursive: true });
  const temporary = output + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log('Saved ' + output + ' (' + snapshot.observed_at + ')');
}

main().catch((error: Error) => {
  console.error(error.message, error.cause ?? '');
  process.exitCode = 1;
});
