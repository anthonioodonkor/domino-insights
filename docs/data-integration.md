# Research ingestion review

Prepared locally on `integration/data-pipeline` from `cleaned-data`. No merge,
publish, push, replay execution, or database ingestion was performed.
The data, scripts, and docs directories now live at the repository root. The
original root README and .gitignore are unchanged; the data package README is
retained as [data-package.md](data-package.md).

## Adapter contract

`scripts/research_adapter.mjs` explicitly maps `COMP-CH-01` to `MS-CHILLER-1`.
This is an application crosswalk, not an assertion that the simulated Chicago
chiller is a real campus asset. CSVs and source provenance remain unchanged.
Each adapted row retains the entire original reading, source metadata, sequence
annotation, and applied mapping under `provenance`. It carries
`source_kind: research_simulation`, `is_live: false`, and `sequence_id`.
Original timestamps are preserved, never rebased to the replay clock.

The offline worker now supports `--source research --sequence LBNL-2E91` or
`--sequence LBNL-7C4A`; a missing or unknown sequence fails. It checks counts,
one-minute cadence, bounds, metric coverage, numeric values, duplicate IDs, and
component mappings before emitting rows. Playback speed only changes delays.
Scenario mode remains synthetic and does not apply the research-only crosswalk.
Both modes output provenance labels in addition to the original five fields.

Validation command (does not execute the replay worker or connect to SpacetimeDB):

```sh
node --test scripts/research_adapter.test.mjs
```

## Timestamp review — 2026-11-08

Reviewed the [official dataset page](https://faultdetection.lbl.gov/dataset/simulated-chiller-plant/)
and [September 2022 inventory](https://fdddata.lbl.gov/data/Simulated_LBNL_FDD_Data_Sets_Chiller_Plant/LBNL_FDD_Data_Sets_Chiller_Plant.pdf).
They describe simulation and one-minute measurements, but no authoritative UTC
offset or daylight-saving policy was found. Chicago location alone does not
establish whether the simulation uses civil time or fixed standard time.
The normalized fixed `-06:00` offset remains an assumption, marked
`unverified_fixed_offset` in adapter provenance. Do not silently change it or
claim these timestamps are independently verified UTC observations. Obtain the
simulation clock configuration or author confirmation before revising it.

## Backend integration gate

The reviewed `origin/cleaned-data` worker had only synthetic stdout playback,
with no component crosswalk or reducer calls. The local backend on this branch
has no research ingestion reducer. The reviewed
`origin/feature/spacetime-engine` reducer `ingestDemoTelemetry` accepts only
reading ID, component ID, and binary operational status; it stamps current time
and can create incidents. It cannot preserve research metrics or provenance.
Do not interpret `chiller_on` as equipment health or pass research data through
that reducer.

Before testing `cbre-telemetry-dev`, agree on a historical ingestion reducer that
stores measurement time, metric, source kind, sequence identity, and provenance
transactionally. Deduplicate by source/run/reading identity, reject conflicting
retries, and keep replay histories out of live operational response. Confirm
`MS-CHILLER-1` exists and regenerate bindings after that contract is implemented.
Database transport and development database testing remain pending. No backend
schema changes are included in this patch.
