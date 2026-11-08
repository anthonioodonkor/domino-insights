# Domino Insights data package

This package contains LLM retrieval and evaluation files, canonical SpacetimeDB-shaped telemetry, and a fictional five-silo cooling replay for HackUTD 2026.

## Start with the LLM files

| File under `data/llm/` | Use |
|---|---|
| `retrieval_corpus.jsonl` | Index `text` for retrieval. Keep the rest of the record for filtering and attribution. |
| `qa_eval_inputs.jsonl` | Five evidence-grounded questions. Use `evidence_doc_ids` for an oracle-context test, or omit them from the model prompt for a retrieval test. |
| `qa_eval_answers.jsonl` | Separate reference answers. Join by `example_id` in the scoring step. |
| `hvac_eval_inputs.jsonl` | Eight 30-minute research telemetry windows. Feed the model the values, column definitions, time range, and cadence. |
| `hvac_eval_labels.jsonl` | Separate source classifications and sensor bias targets. Join by `example_id` in the scoring step. |

Each JSONL line is a UTF-8 JSON object. Keep answer files, raw filenames, and research fault annotations out of model context and the retrieval index when evaluating. For blind HVAC tests, withhold IDs, URLs and annotations from the model prompt and use IDs only for scoring. The HVAC windows belong to two matched runs and are correlated. Treat the paired runs as one held-out group. The bundle provides a smoke test for prompts and scoring, with no training set or basis for generalization estimates. Scenario QA questions ask about the completed replay and may use later evidence. For a live evaluation, filter events by `timestamp` and slice telemetry to the decision time before prompting.

## Reproduce and run

Requires Python 3.10+ and Node.js 22.18+ for native TypeScript stripping.

```sh
python3 scripts/build_campus.py
python3 scripts/build_llm.py
node scripts/replay_telemetry.ts --phase fault > fault_readings.jsonl
node scripts/replay_telemetry.ts --speed 120 > full_replay.jsonl
```

The replay emits telemetry NDJSON with source_kind and is_live labels to stdout. Research mode additionally preserves provenance; see [integration review](data-integration.md). Its default speed of zero emits all selected samples immediately. Positive values express multiples of real time. The offline snapshot ships with the package. To refresh it and rebuild the LLM corpus, run:

```sh
node scripts/fetch_weather.ts
python3 scripts/build_llm.py
```

For exact HVAC reproduction, download the official chiller archive linked in [HVAC research](hvac-research.md), then run `python3 scripts/normalize_lbnl.py /path/to/archive.zip` and rebuild the LLM files.

## Integration handoff

- [Field mapping](field-mapping.md) covers ingestion shape, timestamps, units and how to join provenance.
- [Cooling scenario](scenario-cooling.md) contains event ordering, test checkpoints, and the fictional SLA calculation.
- [Source bibliography](data-sources.md) distinguishes research simulation, external model estimates, and synthetic campus data.

Live SpacetimeDB reducer integration is pending the published reducer signature and generated client bindings from Developer 2. The local worker supports offline validation and does not connect to a database. Confirm the seed IDs, telemetry timestamp type, event reducer contract and retry/idempotency behavior with Developer 2 before connecting. The current local integration branch is `integration/data-pipeline`.
