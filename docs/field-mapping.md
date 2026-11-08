# Data contract and provenance

See [integration review](data-integration.md) for the campus crosswalk and pending
backend contract. The research adapter maps `COMP-CH-01` to `MS-CHILLER-1` only in
its output, preserving the original reading and metadata in `provenance`.
Research output requires one sequence and is always labeled historical
`research_simulation` with `is_live: false`. The fixed UTC offset is unverified.

`data/processed/hvac_readings.csv`, `data/synthetic/utility_readings.csv` and the scenario's `telemetry` array use the same five fields. CSV values and timestamps must be parsed as numbers before reducer submission.

| Field | Type | Contract |
|---|---|---|
| `reading_id` | String | Stable unique ID per observation, including sequence identity for LBNL. |
| `component_id` | String | Foreign key to `data/synthetic/assets.csv`. `COMP-CH-01` is a research crosswalk when it occurs in the research extract. |
| `metric_name` | String | Stable metric identifier and lookup key for units. |
| `value` | Number | Finite numeric observation. Status values use 0/off and 1/on. |
| `timestamp` | Integer | UTC Unix milliseconds. LBNL UTC conversion uses a documented assumed offset. |

| Source and storage | Unit/provenance lookup |
|---|---|
| Research HVAC | `data/processed/hvac_provenance.json` maps metrics to source columns and units. Join `hvac_fault_annotations.json` to the first two hyphen-delimited tokens of `reading_id` for original run and class. |
| Fictional replay and utility CSV | The scenario declares `source_kind: synthetic`. The utility CSV duplicates the scenario's utilities subset by `reading_id`. Ingest one copy. |
| Dallas weather | `data/snapshots/weather_snapshot.json` retains API fields, normalized signals, model grid coordinates, retrieval time and model-valid time. Keep this on a separate external-signal path. |

| Synthetic metrics | Unit |
|---|---|
| `chilled_water_supply_temp_c`, `chilled_water_return_temp_c`, `supply_air_temp_c`, `zone_temp_c` | °C (UCUM `Cel`) |
| `chiller_power_kw`, `electric_demand_kw` | kW |
| `chiller_load_pct`, `ups_charge_pct` | % |
| `line_voltage_v` | V |
| `chiller_on`, `generator_on` | Binary, unit 1 |

Dependencies are directed upstream → downstream. Relation types distinguish primary and alternate routes and ordinary versus standby service. Standby cooling requires approval and alternate maintenance entry requires an escort. Tenant leases join on `service_component_id`. Operational events are discrete JSON records with `event_id`, `scenario_id`, `timestamp`, `component_id`, `silo`, `event_type`, `source_kind` and typed-by-event `details`. Same-timestamp events follow array order. Their reducer contract is pending.

Load research runs individually by sequence. Running both matched research cases together would mix different histories for the same asset and timestamps. Replay the campus incident using its scenario telemetry stream. For a future reducer worker, use stable reading IDs with backend deduplication before retrying an uncertain submission.
