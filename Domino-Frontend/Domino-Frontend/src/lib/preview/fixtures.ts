import type { DemoFixture, ImpactInput, SensorReading } from "../types";

// A frozen UTC clock makes seed/reset independent from the operator's wall clock.
export const DEMO_AS_OF = Date.UTC(2026, 10, 7, 15, 0, 0);
export const FAILURE_ASSET_ID = "CH-02";
export const DEFAULT_IMPACT: ImpactInput = {
  affectedPeople: 180,
  disruptionHours: 6,
  costPerPersonHour: 65,
  baselineResponseCost: 1200,
  proposalHours: 1.5,
  proposalResponseCost: 4500,
};

/** Return new records on every call so reset cannot inherit prior mutations. */
export function createDemoFixture(): DemoFixture {
  const buildings = [
    {
      id: "BLD-A",
      name: "Office Tower A",
      locationLabel: "Synthetic downtown portfolio · Dallas, TX",
    },
    {
      id: "BLD-B",
      name: "Innovation Center B",
      locationLabel: "Synthetic campus portfolio · Richardson, TX",
    },
  ];
  const zones = [
    { id: "A-Z1", buildingId: "BLD-A", name: "Zone 1", capacity: 180 },
    { id: "A-Z2", buildingId: "BLD-A", name: "Zone 2", capacity: 140 },
    { id: "A-Z3", buildingId: "BLD-A", name: "Zone 3", capacity: 200 },
    { id: "B-Z1", buildingId: "BLD-B", name: "Zone 1", capacity: 220 },
    { id: "B-Z2", buildingId: "BLD-B", name: "Zone 2", capacity: 100 },
  ];
  const assets = [
    {
      id: "CH-01",
      buildingId: "BLD-A",
      zoneId: "A-Z1",
      name: "Lobby Chiller",
      assetType: "Chiller",
      status: "operational",
    },
    {
      id: "AHU-01",
      buildingId: "BLD-A",
      zoneId: "A-Z2",
      name: "East Air Handler",
      assetType: "Air handler",
      status: "operational",
    },
    {
      id: FAILURE_ASSET_ID,
      buildingId: "BLD-A",
      zoneId: "A-Z3",
      name: "Zone 3 Chiller",
      assetType: "Chiller",
      status: "operational",
    },
    {
      id: "P-01",
      buildingId: "BLD-A",
      zoneId: "A-Z3",
      name: "Chilled Water Pump",
      assetType: "Pump",
      status: "operational",
    },
    {
      id: "CH-03",
      buildingId: "BLD-B",
      zoneId: "B-Z1",
      name: "Campus Chiller",
      assetType: "Chiller",
      status: "operational",
    },
    {
      id: "AHU-02",
      buildingId: "BLD-B",
      zoneId: "B-Z1",
      name: "North Air Handler",
      assetType: "Air handler",
      status: "operational",
    },
    {
      id: "P-02",
      buildingId: "BLD-B",
      zoneId: "B-Z2",
      name: "Service Water Pump",
      assetType: "Pump",
      status: "operational",
    },
    {
      id: "EL-01",
      buildingId: "BLD-B",
      zoneId: "B-Z2",
      name: "Service Electrical Panel",
      assetType: "Electrical",
      status: "operational",
    },
  ];
  const readings: SensorReading[] = [];
  for (const [assetIndex, asset] of assets.entries()) {
    for (const [sampleIndex, age] of [900_000, 600_000, 300_000].entries()) {
      const recordedAt = DEMO_AS_OF - age;
      readings.push({
        id: asset.id + "-base-output-" + sampleIndex,
        assetId: asset.id,
        metric: "output_pct",
        value: 96 - (assetIndex % 3) - sampleIndex * 0.5,
        recordedAt,
      });
      readings.push({
        id: asset.id + "-base-temp-" + sampleIndex,
        assetId: asset.id,
        metric: "temperature_c",
        value: 22 + (assetIndex % 3) * 0.2 + sampleIndex * 0.1,
        recordedAt,
      });
    }
  }
  return {
    buildings,
    zones,
    assets,
    readings,
    tickets: [
      {
        id: "WO-CH02-001",
        assetId: FAILURE_ASSET_ID,
        summary:
          "Inspect intermittent chiller vibration; work order awaiting service.",
        priority: "high",
        status: "open",
      },
    ],
    occupancy: zones.map((zone, index) => ({
      id: "OCC-" + zone.id,
      zoneId: zone.id,
      people: [92, 64, 180, 110, 40][index]!,
      recordedAt: DEMO_AS_OF,
    })),
    asOf: DEMO_AS_OF,
  };
}

/** Scripted telemetry only; the preview adapter owns local state changes. */
export function createFailureReadings(asOf = DEMO_AS_OF): SensorReading[] {
  if (!Number.isFinite(asOf) || asOf < 240_000) {
    throw new RangeError(
      "Scenario clock must be finite and at least four minutes after epoch.",
    );
  }
  const readings: SensorReading[] = [];
  const samples = [
    { age: 240_000, output: 68, temperature: 24.5 },
    { age: 120_000, output: 59, temperature: 26.2 },
    { age: 0, output: 54, temperature: 28.1 },
  ];
  for (const sample of samples) {
    const recordedAt = asOf - sample.age;
    readings.push({
      id: FAILURE_ASSET_ID + "-failure-output-" + recordedAt,
      assetId: FAILURE_ASSET_ID,
      metric: "output_pct",
      value: sample.output,
      recordedAt,
    });
    readings.push({
      id: FAILURE_ASSET_ID + "-failure-temp-" + recordedAt,
      assetId: FAILURE_ASSET_ID,
      metric: "temperature_c",
      value: sample.temperature,
      recordedAt,
    });
  }
  return readings;
}
