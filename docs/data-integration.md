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

### Decision and supporting evidence

Retain fixed UTC-06:00 year-round, with `timestamp.verification_status` set to
`unverified` in `data/processed/hvac_provenance.json`. The
[EnergyPlus 22.1 Input Output Reference, section 1.7.9](https://energyplus.net/assets/nrel_custom/pdfs/pdfs_v22.1.0/InputOutputReference.pdf)
specifies standard-time timestamps for Output:Variable and Output:Meter;
daylight-saving settings shift schedules and controls. The
[online reference](https://energyplus.readthedocs.io/en/stable/guides/input-output-reference/1.7-group-location-climate-weather-file-access.html)
states the same convention under RunPeriodControl:DaylightSavingTime.
This supports the existing assumption but does not prove how LBNL generated
`Datetime` in its EnergyPlus-Modelica co-simulation export. The dataset's
EnergyPlus version is not established by citing the 22.1 manual.

The [public distribution listing](https://fdddata.lbl.gov/data/Simulated_LBNL_FDD_Data_Sets_Chiller_Plant/)
lists inventory/data/Brick archives, not a separately listed clock configuration
or export script. No dataset-specific exporter was located in the repository or
targeted web searches. The full source archive was not downloaded for this review.
Verification requires the model clock and export configuration or explicit author
confirmation; the generic EnergyPlus rule alone is insufficient.

| Interpretation of source `2018-07-16 14:00:00` | UTC | Unix milliseconds |
|---|---|---|
| Fixed Chicago standard time, retained assumption | 2018-07-16 20:00:00Z | 1531771200000 |
| Chicago civil time, summer UTC-05:00, comparison only | 2018-07-16 19:00:00Z | 1531767600000 |

The difference is one hour. Both interpretations preserve 60-second cadence in
this July window, so cadence cannot resolve the convention. Each stored run has
120 distinct minutes and 480 readings, checked separately against its original
source bounds. Raw timestamp bounds and stored measurement timestamps are unchanged.

`source_datetime_to_utc_ms` in `scripts/normalize_lbnl.py` is the reproducible
conversion used by the normalizer. It rejects timezone-aware inputs and does not
depend on the machine's timezone. The normalizer now retains reviewed timestamp
provenance and refuses to regenerate when that policy conflicts with its converter.
It requires the checked-in provenance file as an input. No dataset regeneration
was performed for this change.

Run the read-only conversion regression tests with:

```sh
python -m unittest discover -s scripts -p test_lbnl_timestamps.py -v
node --test scripts/research_adapter.test.mjs
```

The civil-time comparison uses Python's `zoneinfo` and requires an installed
IANA timezone database (the `tzdata` Python package on systems without one).

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
