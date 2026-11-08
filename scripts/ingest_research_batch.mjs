
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  parseResearchCsv,
  prepareResearchSequence,
} from "./research_adapter.mjs";

// Development database only.
// Never replace this with cbre-telemetry.
const DEV_DATABASE =
  "c2007fc61174d2aaa65e4d092a22cc16b472c76f4905c17749c6de0e6c862970";

const SEQUENCE_ID = "LBNL-2E91";
const BATCH_SIZE = 20;

const args = process.argv.slice(2);
const execute = args.length === 1 && args[0] === "--execute";

if (args.length > 0 && !execute) {
  throw new Error(
    "Unknown arguments. Use no arguments to preview or --execute to ingest."
  );
}

const csv = readFileSync(
  "data/processed/hvac_readings.csv",
  "utf8"
);

const provenance = JSON.parse(
  readFileSync(
    "data/processed/hvac_provenance.json",
    "utf8"
  )
);

const annotations = JSON.parse(
  readFileSync(
    "data/processed/hvac_fault_annotations.json",
    "utf8"
  )
);

// Validate the full research sequence first.
const readings = prepareResearchSequence(
  parseResearchCsv(csv),
  provenance,
  annotations,
  SEQUENCE_ID
);

// Only select the first 20 validated records.
const batch = readings.slice(0, BATCH_SIZE);

if (batch.length !== BATCH_SIZE) {
  throw new Error("Incomplete batch.");
}

console.log("Domino Insights — Historical Research Batch");
console.log("Database: cbre-telemetry-dev");
console.log("Sequence:", SEQUENCE_ID);
console.log("Validated sequence readings:", readings.length);
console.log("Selected batch readings:", batch.length);
console.log("First reading:", batch[0].reading_id);
console.log("Last reading:", batch.at(-1).reading_id);
console.log("Mode:", execute ? "EXECUTE" : "PREVIEW ONLY");

if (!execute) {
  console.log("No database writes performed.");
  console.log("Use --execute after reviewing this preview.");
  process.exit(0);
}

let accepted = 0;

for (const reading of batch) {
  const values = [
    reading.reading_id,
    reading.component_id,
    reading.metric_name,
    reading.value,
    reading.timestamp,
    reading.source_kind,
    reading.is_live,
    reading.sequence_id,
    reading.provenance.mapping.source_component_id,
    reading.provenance.timestamp_verification,
    JSON.stringify(reading.provenance),
  ];

  const result = spawnSync(
    "spacetime",
    [
      "call",
      "--no-config",
      "--server",
      "maincloud",
      DEV_DATABASE,
      "ingest_research_telemetry",
      ...values.map((value) => JSON.stringify(value)),
    ],
    { stdio: "inherit" }
  );

  if (result.error || result.status !== 0) {
    console.error(
      "Batch stopped at:",
      reading.reading_id
    );

    if (result.error) {
      console.error(result.error);
    }

    process.exit(1);
  }

  accepted++;

  console.log(
    `Processed ${accepted}/${batch.length}: ${reading.reading_id}`
  );
}

console.log("Batch complete.");
console.log("Successfully processed:", accepted);