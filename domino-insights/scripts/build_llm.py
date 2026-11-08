"""Validate canonical inputs and build retrieval and held-out evaluation JSONL."""
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone

from normalize_lbnl import FIELDS, ROOT

DATA = ROOT / "data"
OUT = DATA / "llm"


def read_json(path):
    return json.loads((DATA / path).read_text(encoding="utf-8"))


def read_csv(path):
    with (DATA / path).open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def write_jsonl(name, rows):
    with (OUT / name).open("w", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def iso(timestamp):
    return datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat().replace("+00:00", "Z")


def window_groups(rows, metrics, start, count):
    by_key = {(row["timestamp"], row["metric_name"]): row for row in rows}
    grid = range(start, start + count * 60_000, 60_000)
    require(len(by_key) == len(rows) == count * len(metrics), "Unexpected window cardinality")
    return [[by_key[timestamp, name]["value"] for name in metrics] for timestamp in grid]


def main():
    assets = read_csv("synthetic/assets.csv")
    asset_ids = {asset["component_id"] for asset in assets}
    require(15 <= len(assets) <= 20 and len(asset_ids) == len(assets), "Invalid asset inventory")
    dependencies = read_csv("synthetic/dependencies.csv")
    for edge in dependencies:
        require({edge["upstream_component_id"], edge["downstream_component_id"]} <= asset_ids,
                "Unknown dependency endpoint")
    leases = read_csv("synthetic/tenant_leases.csv")
    tenant_ids = {lease["tenant_id"] for lease in leases}
    require(3 <= len(leases) <= 5 and len(tenant_ids) == len(leases), "Invalid tenant inventory")
    scenario = read_json("scenarios/cooling_cascade.json")
    telemetry = scenario["telemetry"]
    weather = read_json("snapshots/weather_snapshot.json")
    require(iso(weather["timestamp"])[:16] == weather["observed_at"][:16] and
            datetime.fromisoformat(weather["observed_at"]) <= datetime.fromisoformat(weather["retrieved_at"]),
            "Invalid weather timestamps")

    all_ids = set()
    research = defaultdict(list)
    for row in read_csv("processed/hvac_readings.csv"):
        row["timestamp"] = int(row["timestamp"])
        row["value"] = float(row["value"])
        research["-".join(row["reading_id"].split("-")[:2])].append(row)

    scenario_keys = set()
    for row in telemetry:
        key = row["timestamp"], row["component_id"], row["metric_name"]
        require(key not in scenario_keys, "Duplicate scenario sample")
        scenario_keys.add(key)
    for collection in [telemetry, *research.values()]:
        require(collection == sorted(collection, key=lambda row: (row["timestamp"], row["reading_id"])),
                "Telemetry order is unstable")
        for row in collection:
            require(set(row) == set(FIELDS) and row["reading_id"] not in all_ids, "Invalid reading identity or shape")
            require(row["component_id"] in asset_ids and math.isfinite(row["value"]) and type(row["timestamp"]) is int,
                    "Invalid telemetry value, timestamp or asset")
            all_ids.add(row["reading_id"])

    start = scenario["timestamp_start"]
    phases = scenario["phases"]
    require(phases[0]["start_minute"] == 0 and all(
        a["end_minute_exclusive"] == b["start_minute"] for a, b in zip(phases, phases[1:])
    ), "Invalid phase boundaries")
    times = list(range(start, start + 60_000 * phases[-1]["end_minute_exclusive"], 60_000))
    require({row["timestamp"] for row in telemetry} == set(times), "Unexpected scenario cadence")
    require(len(telemetry) == 260 and all(sum(row["timestamp"] == t for row in telemetry) == 13 for t in times),
            "Missing scenario readings")
    index = {(row["timestamp"], row["component_id"], row["metric_name"]): row["value"] for row in telemetry}
    utility = read_csv("synthetic/utility_readings.csv")
    utility_ids = {row["reading_id"] for row in utility}
    expected_utility = [row for row in telemetry if row["component_id"] in {
        asset["component_id"] for asset in assets if asset["silo"] == "utilities"
    }]
    require(len(utility) == len(expected_utility) and utility_ids == {row["reading_id"] for row in expected_utility}
            and all(index[int(row["timestamp"]), row["component_id"], row["metric_name"]] == float(row["value"])
                    for row in utility), "Utility CSV differs from replay")

    events = read_json("synthetic/operational_events.json")
    require(scenario["operational_event_ids"] == [event["event_id"] for event in events], "Event list mismatch")
    seen_events = {}
    for event in events:
        details = event["details"]
        require(event["event_id"] not in seen_events and event["component_id"] in asset_ids
                and event["scenario_id"] == scenario["scenario_id"] and event["timestamp"] in times,
                "Invalid event identity, asset or timestamp")
        require(not seen_events or event["timestamp"] >= max(seen_events.values()), "Unordered event")
        upstream = details.get("upstream_event_id")
        require(not upstream or upstream in seen_events, "Event points to a missing or future event")
        require(set(details.get("tenant_ids", [])) <= tenant_ids, "Unknown tenant")
        for key in ("assigned_to_asset_id", "pump_component_id"):
            require(key not in details or details[key] in asset_ids, "Unknown asset in event details")
        seen_events[event["event_id"]] = event["timestamp"]

    contexts = []
    def document(doc_id, kind, source_id, source_kind, source_path, text, attributes):
        contexts.append(dict(
            schema_version="1.0", doc_id=doc_id, kind=kind, source_id=source_id, source_kind=source_kind,
            source_path=source_path, text=text, attributes=attributes,
        ))

    def campus(doc_id, kind, path, text, **attributes):
        document(doc_id, kind, "domino_campus", "synthetic", path, text, attributes)

    for asset in assets:
        campus(asset["component_id"], "asset", "data/synthetic/assets.csv",
               f"{asset['name']} ({asset['component_id']}) belongs to {asset['silo']}.", **asset)
    for i, edge in enumerate(dependencies, start=1):
        campus(f"DEP-{i:02}", "dependency", "data/synthetic/dependencies.csv",
               f"{edge['downstream_component_id']} depends on {edge['upstream_component_id']} via {edge['relation']}.", **edge)
    exposure = {}
    for lease in leases:
        service = lease["service_component_id"]
        require(service in asset_ids, "Unknown leased service")
        threshold = float(lease["threshold_c"])
        grace = int(lease["grace_minutes"])
        rate = int(lease["rate_cents_per_hour"])
        require(grace >= 0 and rate >= 0 and rate % 60 == 0, "Invalid fictional lease terms")
        run = billable = 0
        for time in times:
            run = run + 1 if index[time, service, "zone_temp_c"] > threshold else 0
            billable += int(run > grace)
        exposure[lease["tenant_id"]] = billable * (rate // 60)
        campus(lease["tenant_id"], "fictional_sla", "data/synthetic/tenant_leases.csv",
               f"{lease['tenant_name']} depends on {service}. Each one-minute sample strictly above {threshold:g} °C counts toward a continuous excursion. "
               f"After {grace} consecutive minutes of grace, the illustrative rate is USD {rate / 100:,.2f}/hour, prorated by minute.",
               **{**lease, "threshold_c": threshold, "grace_minutes": grace, "rate_cents_per_hour": rate})
    for event in events:
        campus(event["event_id"], "operational_event", "data/synthetic/operational_events.json",
               f"{iso(event['timestamp'])} | {event['component_id']} | {event['event_type'].replace('_', ' ')}. "
               + json.dumps(event["details"], ensure_ascii=False), **event)
    metric_units = {
        "chilled_water_supply_temp_c": "Cel", "chilled_water_return_temp_c": "Cel",
        "supply_air_temp_c": "Cel", "zone_temp_c": "Cel", "chiller_load_pct": "%",
        "ups_charge_pct": "%", "chiller_power_kw": "kW", "electric_demand_kw": "kW",
        "line_voltage_v": "V", "chiller_on": "1", "generator_on": "1",
    }
    asset_metrics = defaultdict(set)
    for _, asset, metric in index:
        asset_metrics[asset].add(metric)
    for asset, metrics_for_asset in sorted(asset_metrics.items()):
        for metric in sorted(metrics_for_asset):
            values = [index[time, asset, metric] for time in times]
            unit = metric_units[metric]
            doc_id = f"TS-{asset}" if len(metrics_for_asset) == 1 else f"TS-{asset}-{metric}"
            campus(doc_id, "telemetry_window", "data/scenarios/cooling_cascade.json",
                   f"{asset} {metric} ({unit}) at one-minute intervals starting {iso(start)}: "
                   + ", ".join(map(str, values)),
                   component_id=asset, metric_name=metric, start_timestamp=start,
                   end_timestamp=times[-1], interval_seconds=60, values=values, unit=unit)
    require(exposure == {"TEN-01": 3000, "TEN-02": 0, "TEN-03": 0}, "Unexpected fictional SLA calculation")

    require(len(weather["signals"]) == 3 and all(math.isfinite(signal["value"]) for signal in weather["signals"]),
            "Invalid weather values")
    weather_values = {signal["metric_name"]: signal["value"] for signal in weather["signals"]}
    document("WX-DALLAS-01", "weather_snapshot", "open_meteo", "external_model_estimate",
             "data/snapshots/weather_snapshot.json",
             f"Dallas-area weather-model estimate for {weather['observed_at']}. "
             + "; ".join(f"{signal['metric_name']} = {signal['value']} {signal['unit']}" for signal in weather["signals"])
             + ". Weather data by Open-Meteo.com.",
             {key: weather[key] for key in ("attribution", "source_url", "license", "observed_at", "retrieved_at", "signals")})

    qa = [
        ("QA-01", "Why did the primary maintenance entry check fail, and what authorized route was used?",
         ["EV-05", "EV-06", "EV-08"], "The primary controller was unavailable due to a separate maintenance-link fault. Escorted entry was authorized via alternate reader COMP-BR-02."),
        ("QA-02", "How much illustrative SLA exposure did TEN-01 incur over the completed cooling replay?",
         ["TEN-01", "TS-COMP-HALL-01"], f"USD {exposure['TEN-01'] / 100:.2f}. Six consecutive one-minute samples exceeded 27 °C. Three were billable after the three-minute grace period at USD 10 per minute."),
        ("QA-03", "What caused the load increase at the plant electrical panel in the cooling replay?",
         ["EV-10", "EV-11"], "Operator-approved startup of the standby cooling system increased plant panel demand."),
        ("QA-04", "What outdoor temperature does the supplied Dallas snapshot give, and what kind of source produced it?",
         ["WX-DALLAS-01"], f"{weather_values['outdoor_temp_c']:g} °C from an Open-Meteo weather-model estimate."),
        ("QA-05", "What were the documented facilities response time and final work-order status?",
         ["EV-04", "EV-09", "EV-15"], "The technician arrived four minutes after assignment, and work order WO-01 was resolved."),
    ]
    annotations = read_json("processed/hvac_fault_annotations.json")["sequences"]
    provenance = read_json("processed/hvac_provenance.json")
    require({item["sequence_id"] for item in annotations} == set(research), "Unmatched research annotations")
    metrics = sorted(provenance["metrics"])
    hvac_inputs, hvac_labels = [], []
    for annotation in annotations:
        seq = annotation["sequence_id"]
        rows = research[seq]
        points = window_groups(rows, metrics, rows[0]["timestamp"], annotation["source_row_count"])
        require(len(rows) == annotation["reading_count"], "Research count mismatch")
        for offset in range(0, len(points), 30):
            example_id = f"{seq}-W{offset // 30 + 1:02}"
            hvac_inputs.append(dict(
                schema_version="1.0", example_id=example_id, sequence_id=seq, split="eval",
                source_id="lbnl_chiller_plant", source_kind="research_simulation", source_url=provenance["source_url"],
                component_id="COMP-CH-01", start_timestamp=rows[0]["timestamp"] + offset * 60_000,
                interval_seconds=60, columns=[{"metric_name": name, "unit": provenance["metrics"][name]["unit"]}
                                              for name in metrics],
                values=points[offset:offset + 30],
            ))
            hvac_labels.append(dict(example_id=example_id, sequence_id=seq, split="eval",
                                    fault_class=annotation["source_fault_class"],
                                    sensor_bias_delta_c=annotation["sensor_bias_delta_c"]))

    context_ids = {doc["doc_id"] for doc in contexts}
    require(len(context_ids) == len(contexts), "Duplicate context IDs")
    require(all(set(doc_ids) <= context_ids for _, _, doc_ids, _ in qa), "Missing evidence document")
    OUT.mkdir(parents=True, exist_ok=True)
    write_jsonl("retrieval_corpus.jsonl", contexts)
    write_jsonl("qa_eval_inputs.jsonl", [dict(example_id=id_, split="eval", question=question, evidence_doc_ids=docs)
                                       for id_, question, docs, _ in qa])
    write_jsonl("qa_eval_answers.jsonl", [dict(example_id=id_, split="eval", expected_answer=answer)
                                        for id_, _, _, answer in qa])
    write_jsonl("hvac_eval_inputs.jsonl", hvac_inputs)
    write_jsonl("hvac_eval_labels.jsonl", hvac_labels)
    print(f"Validated {len(all_ids)} telemetry rows, {len(assets)} assets, {len(events)} events, "
          f"{len(leases)} tenants, {len(contexts)} retrieval docs and {len(qa) + len(hvac_inputs)} eval records.")


if __name__ == "__main__":
    main()
