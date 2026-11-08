"""Validate canonical inputs and build retrieval and held-out evaluation JSONL."""
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone

from normalize_lbnl import FIELDS, ROOT

DATA = ROOT / "data"
OUT = DATA / "llm"


def read_json(path, required=None):
    value = json.loads((DATA / path).read_text(encoding="utf-8"))
    if required is not None:
        required_keys(value, required, f"data/{path}")
    return value


def read_csv(path, expected):
    full_path = f"data/{path}"
    with (DATA / path).open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames or []
        require(len(headers) == len(set(headers)), "Duplicate CSV column names", full_path)
        require(set(headers) == set(expected),
                f"Unexpected columns: {sorted(set(headers) - set(expected))}; "
                f"missing columns: {sorted(set(expected) - set(headers))}", full_path)
        rows = list(reader)

    for row_number, row in enumerate(rows, start=2):
        record = row.get("reading_id", row.get("component_id", row.get("tenant_id", row_number)))
        require(None not in row, "Row has more fields than the header", full_path, record)
        require(all(value is not None for value in row.values()), "Row has fewer fields than the header", full_path, record)
    return rows


def write_jsonl(name, rows):
    with (OUT / name).open("w", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")


def require(condition, message, path="<validation>", record=None):
    if not condition:
        location = path if record is None else f"{path} [record: {record}]"
        raise ValueError(f"{location}: {message}")


def required_keys(obj, keys, path, record=None):
    require(isinstance(obj, dict), "Expected JSON object", path, record)
    missing = set(keys) - set(obj)
    require(not missing, f"Missing required keys: {sorted(missing)}", path, record)


def validate_nonblank(value, field, path, record):
    require(isinstance(value, str) and bool(value.strip()),
            f"{field} must be a nonblank string", path, record)


def validate_finite_number(value, field, path, record, minimum=None, maximum=None):
    require(not isinstance(value, bool), f"{field} must be numeric, not boolean", path, record)
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{path} [record: {record}]: {field} must be numeric") from None
    require(math.isfinite(number), f"{field} must be finite", path, record)
    if minimum is not None:
        require(number >= minimum, f"{field} below minimum {minimum}", path, record)
    if maximum is not None:
        require(number <= maximum, f"{field} above maximum {maximum}", path, record)
    return number


def validate_integer(value, field, path, record, minimum=None):
    try:
        text = str(value).strip()
        number = int(text)
    except (TypeError, ValueError):
        raise ValueError(f"{path} [record: {record}]: {field} must be an integer") from None
    require(str(number) == text or text == f"+{number}", f"{field} must be an integer", path, record)
    if minimum is not None:
        require(number >= minimum, f"{field} below minimum {minimum}", path, record)
    return number


def parse_iso_timestamp(value, field, path, record):
    validate_nonblank(value, field, path, record)
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        raise ValueError(f"{path} [record: {record}]: {field} must be a valid ISO 8601 timestamp") from None
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None,
            f"{field} must include a timezone", path, record)
    return parsed


def iso(timestamp):
    return datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat().replace("+00:00", "Z")


def window_groups(rows, metrics, start, count):
    by_key = {(row["timestamp"], row["metric_name"]): row for row in rows}
    grid = range(start, start + count * 60_000, 60_000)
    require(len(by_key) == len(rows) == count * len(metrics), "Unexpected window cardinality")
    return [[by_key[timestamp, name]["value"] for name in metrics] for timestamp in grid]


CSV_COLUMNS = {
    "synthetic/assets.csv": ("component_id", "silo", "asset_type", "name", "source_kind"),
    "synthetic/dependencies.csv": ("upstream_component_id", "downstream_component_id", "relation", "source_kind"),
    "synthetic/tenant_leases.csv": ("tenant_id", "tenant_name", "service_component_id", "threshold_c",
                                    "grace_minutes", "rate_cents_per_hour", "currency", "source_kind"),
    "synthetic/utility_readings.csv": FIELDS,
    "processed/hvac_readings.csv": FIELDS,
}


def validated_telemetry(row, path, record, coerce_value=True):
    for field in ("reading_id", "component_id", "metric_name"):
        validate_nonblank(row[field], field, path, record)
    value = validate_finite_number(row["value"], "value", path, record)
    if coerce_value:
        row["value"] = value
    row["timestamp"] = validate_integer(row["timestamp"], "timestamp", path, record, minimum=0)
    return row


def main():
    assets = read_csv("synthetic/assets.csv", CSV_COLUMNS["synthetic/assets.csv"])
    for number, asset in enumerate(assets, start=2):
        for field in CSV_COLUMNS["synthetic/assets.csv"]:
            validate_nonblank(asset[field], field, "data/synthetic/assets.csv", number)
        require(asset["source_kind"] == "synthetic", "Asset must be labeled synthetic",
                "data/synthetic/assets.csv", asset["component_id"])
    asset_ids = {asset["component_id"] for asset in assets}
    require(15 <= len(assets) <= 20 and len(asset_ids) == len(assets), "Invalid asset inventory")
    dependencies = read_csv("synthetic/dependencies.csv", CSV_COLUMNS["synthetic/dependencies.csv"])
    dependency_keys = set()
    for edge in dependencies:
        for field in CSV_COLUMNS["synthetic/dependencies.csv"]:
            validate_nonblank(edge[field], field, "data/synthetic/dependencies.csv", edge["upstream_component_id"])
        require(edge["source_kind"] == "synthetic", "Dependency must be labeled synthetic",
                "data/synthetic/dependencies.csv", edge["upstream_component_id"])
        require({edge["upstream_component_id"], edge["downstream_component_id"]} <= asset_ids,
                "Unknown dependency endpoint", "data/synthetic/dependencies.csv", edge["upstream_component_id"])
        key = (edge["upstream_component_id"], edge["downstream_component_id"], edge["relation"])
        require(key not in dependency_keys, "Duplicate dependency edge", "data/synthetic/dependencies.csv", key)
        dependency_keys.add(key)
    leases = read_csv("synthetic/tenant_leases.csv", CSV_COLUMNS["synthetic/tenant_leases.csv"])
    for number, lease in enumerate(leases, start=2):
        for field in ("tenant_id", "tenant_name", "service_component_id", "currency", "source_kind"):
            validate_nonblank(lease[field], field, "data/synthetic/tenant_leases.csv", number)
    tenant_ids = {lease["tenant_id"] for lease in leases}
    require(3 <= len(leases) <= 5 and len(tenant_ids) == len(leases), "Invalid tenant inventory")
    scenario = read_json("scenarios/cooling_cascade.json", {"scenario_id", "source_kind", "timestamp_start", "phases", "telemetry", "operational_event_ids"})
    validate_nonblank(scenario["scenario_id"], "scenario_id", "data/scenarios/cooling_cascade.json", None)
    require(scenario["source_kind"] == "synthetic", "Scenario must be labeled synthetic", "data/scenarios/cooling_cascade.json")
    start = validate_integer(scenario["timestamp_start"], "timestamp_start", "data/scenarios/cooling_cascade.json", None, minimum=0)
    require(isinstance(scenario["phases"], list) and bool(scenario["phases"]),
            "phases must be a nonempty array", "data/scenarios/cooling_cascade.json")
    require(isinstance(scenario["telemetry"], list), "telemetry must be an array", "data/scenarios/cooling_cascade.json")
    telemetry = scenario["telemetry"]
    weather_path = "data/snapshots/weather_snapshot.json"
    weather = read_json("snapshots/weather_snapshot.json", {"source_id", "source_kind", "attribution", "license",
                                                                "source_url", "observed_at", "retrieved_at", "timestamp", "signals"})
    observed_at = parse_iso_timestamp(weather["observed_at"], "observed_at", weather_path, None)
    retrieved_at = parse_iso_timestamp(weather["retrieved_at"], "retrieved_at", weather_path, None)
    weather_timestamp = validate_integer(weather["timestamp"], "timestamp", weather_path, None, minimum=0)
    require(int(observed_at.timestamp() * 1000) == weather_timestamp,
            "timestamp does not match observed_at", weather_path)
    require(observed_at <= retrieved_at, "observed_at is later than retrieved_at", weather_path)
    for field in ("source_id", "source_kind", "attribution", "license", "source_url"):
        validate_nonblank(weather[field], field, weather_path, None)
    require(weather["source_kind"] == "external_model_estimate",
            "Weather source_kind must be external_model_estimate", weather_path)

    all_ids = set()
    research = defaultdict(list)
    for row_number, row in enumerate(read_csv("processed/hvac_readings.csv", CSV_COLUMNS["processed/hvac_readings.csv"]), start=2):
        validated_telemetry(row, "data/processed/hvac_readings.csv", row.get("reading_id", row_number))
        research["-".join(row["reading_id"].split("-")[:2])].append(row)

    scenario_keys = set()
    require(isinstance(telemetry, list), "telemetry must be an array", "data/scenarios/cooling_cascade.json")
    for row_number, row in enumerate(telemetry, start=1):
        require(isinstance(row, dict), "Expected telemetry object", "data/scenarios/cooling_cascade.json", row_number)
        require(set(row) == set(FIELDS), "Invalid telemetry fields", "data/scenarios/cooling_cascade.json", row.get("reading_id", row_number))
        validated_telemetry(row, "data/scenarios/cooling_cascade.json", row.get("reading_id", row_number), coerce_value=False)
        key = row["timestamp"], row["component_id"], row["metric_name"]
        require(key not in scenario_keys, "Duplicate scenario sample", "data/scenarios/cooling_cascade.json", row["reading_id"])
        scenario_keys.add(key)
    for collection in [telemetry, *research.values()]:
        require(collection == sorted(collection, key=lambda row: (row["timestamp"], row["reading_id"])),
                "Telemetry order is unstable")
        for row in collection:
            require(row["reading_id"] not in all_ids, "Duplicate reading_id", "telemetry", row["reading_id"])
            require(row["component_id"] in asset_ids, "Unknown telemetry component", "telemetry", row["reading_id"])
            all_ids.add(row["reading_id"])

    phases = scenario["phases"]
    previous_end = 0
    for phase_number, phase in enumerate(phases, start=1):
        required_keys(phase, {"phase", "start_minute", "end_minute_exclusive"},
                      "data/scenarios/cooling_cascade.json", f"phase {phase_number}")
        validate_nonblank(phase["phase"], "phase", "data/scenarios/cooling_cascade.json", phase_number)
        phase["start_minute"] = validate_integer(phase["start_minute"], "start_minute", "data/scenarios/cooling_cascade.json", phase_number, minimum=0)
        phase["end_minute_exclusive"] = validate_integer(phase["end_minute_exclusive"], "end_minute_exclusive", "data/scenarios/cooling_cascade.json", phase_number, minimum=1)
        require(phase["start_minute"] == previous_end, "Phase boundaries must be contiguous",
                "data/scenarios/cooling_cascade.json", phase_number)
        require(phase["end_minute_exclusive"] > phase["start_minute"], "Phase must have positive duration",
                "data/scenarios/cooling_cascade.json", phase_number)
        previous_end = phase["end_minute_exclusive"]
    require(phases[0]["start_minute"] == 0 and all(
        a["end_minute_exclusive"] == b["start_minute"] for a, b in zip(phases, phases[1:])
    ), "Invalid phase boundaries")
    times = list(range(start, start + 60_000 * phases[-1]["end_minute_exclusive"], 60_000))
    require({row["timestamp"] for row in telemetry} == set(times), "Unexpected scenario cadence")
    require(len(telemetry) == 260 and all(sum(row["timestamp"] == t for row in telemetry) == 13 for t in times),
            "Missing scenario readings")
    index = {(row["timestamp"], row["component_id"], row["metric_name"]): row["value"] for row in telemetry}
    utility = read_csv("synthetic/utility_readings.csv", CSV_COLUMNS["synthetic/utility_readings.csv"])
    for row_number, row in enumerate(utility, start=2):
        validated_telemetry(row, "data/synthetic/utility_readings.csv", row.get("reading_id", row_number))
    utility_ids = {row["reading_id"] for row in utility}
    expected_utility = [row for row in telemetry if row["component_id"] in {
        asset["component_id"] for asset in assets if asset["silo"] == "utilities"
    }]
    require(len(utility) == len(expected_utility) and utility_ids == {row["reading_id"] for row in expected_utility}
            and all(index[int(row["timestamp"]), row["component_id"], row["metric_name"]] == float(row["value"])
                    for row in utility), "Utility CSV differs from replay", "data/synthetic/utility_readings.csv")

    events_path = "data/synthetic/operational_events.json"
    events = read_json("synthetic/operational_events.json")
    require(isinstance(events, list), "Events must be a JSON array", events_path)
    require(scenario["operational_event_ids"] == [event.get("event_id") for event in events], "Event list mismatch", events_path)
    seen_events = {}
    for event_number, event in enumerate(events, start=1):
        required_keys(event, {"event_id", "scenario_id", "timestamp", "component_id", "silo", "event_type", "source_kind", "details"}, events_path, event_number)
        for field in ("event_id", "scenario_id", "component_id", "silo", "event_type", "source_kind"):
            validate_nonblank(event[field], field, events_path, event_number)
        event["timestamp"] = validate_integer(event["timestamp"], "timestamp", events_path, event_number, minimum=0)
        require(isinstance(event["details"], dict), "details must be an object", events_path, event["event_id"])
        details = event["details"]
        require(event["source_kind"] == "synthetic", "Event must be labeled synthetic", events_path, event["event_id"])
        require(event["event_id"] not in seen_events and event["component_id"] in asset_ids
                and event["scenario_id"] == scenario["scenario_id"] and event["timestamp"] in times,
                "Invalid event identity, asset or timestamp", events_path, event["event_id"])
        require(not seen_events or event["timestamp"] >= max(seen_events.values()), "Unordered event", events_path, event["event_id"])
        upstream = details.get("upstream_event_id")
        require(not upstream or upstream in seen_events, "Event points to a missing or future event", events_path, event["event_id"])
        event_tenants = details.get("tenant_ids", [])
        require(isinstance(event_tenants, list) and all(isinstance(item, str) for item in event_tenants)
                and set(event_tenants) <= tenant_ids,
                "Unknown tenant or tenant_ids is not an array", events_path, event["event_id"])
        for key in ("assigned_to_asset_id", "pump_component_id"):
            require(key not in details or details[key] in asset_ids, "Unknown asset in event details", events_path, event["event_id"])
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
        threshold = validate_finite_number(lease["threshold_c"], "threshold_c", "data/synthetic/tenant_leases.csv", lease["tenant_id"])
        grace = validate_integer(lease["grace_minutes"], "grace_minutes", "data/synthetic/tenant_leases.csv", lease["tenant_id"], minimum=0)
        rate = validate_integer(lease["rate_cents_per_hour"], "rate_cents_per_hour", "data/synthetic/tenant_leases.csv", lease["tenant_id"], minimum=0)
        require(rate % 60 == 0, "rate_cents_per_hour must divide evenly into minute units", "data/synthetic/tenant_leases.csv", lease["tenant_id"])
        require(lease["currency"] == "USD" and lease["source_kind"] == "synthetic",
                "Lease must use USD and be labeled synthetic", "data/synthetic/tenant_leases.csv", lease["tenant_id"])
        require(all((time, service, "zone_temp_c") in index for time in times),
                "Leased service lacks complete zone temperature telemetry", "data/synthetic/tenant_leases.csv", lease["tenant_id"])
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
        require(metric in metric_units, "No unit mapping for telemetry metric",
                "data/scenarios/cooling_cascade.json", metric)
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

    allowed_weather_units = {
        "outdoor_temp_c": {"Cel"},
        "outdoor_relative_humidity_pct": {"%"},
        "outdoor_wind_speed_kmh": {"km/h"},
    }
    require(isinstance(weather["signals"], list), "signals must be an array", weather_path)
    seen_weather_metrics = set()
    for signal_number, signal in enumerate(weather["signals"], start=1):
        required_keys(signal, {"metric_name", "value", "unit"}, weather_path, f"signal {signal_number}")
        metric = signal["metric_name"]
        require(metric in allowed_weather_units, "Unsupported weather metric", weather_path, metric)
        require(metric not in seen_weather_metrics, "Duplicate weather metric", weather_path, metric)
        seen_weather_metrics.add(metric)
        limits = {
            "outdoor_temp_c": (-80, 70),
            "outdoor_relative_humidity_pct": (0, 100),
            "outdoor_wind_speed_kmh": (0, None),
        }
        minimum, maximum = limits[metric]
        validate_finite_number(signal["value"], "value", weather_path, metric, minimum, maximum)
        require(signal["unit"] in allowed_weather_units[metric], "Unit does not match weather metric", weather_path, metric)
    require(seen_weather_metrics == set(allowed_weather_units), "Missing weather metric", weather_path)
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
    annotation_path = "data/processed/hvac_fault_annotations.json"
    annotations = read_json("processed/hvac_fault_annotations.json", {"sequences"})["sequences"]
    require(isinstance(annotations, list), "sequences must be an array", annotation_path)
    for annotation_number, annotation in enumerate(annotations, start=1):
        required_keys(annotation, {"sequence_id", "reading_count", "source_row_count", "source_fault_class",
                                   "sensor_bias_delta_c"}, annotation_path, annotation_number)
    provenance_path = "data/processed/hvac_provenance.json"
    provenance = read_json("processed/hvac_provenance.json", {"source_url", "metrics"})
    require(isinstance(provenance["metrics"], dict) and bool(provenance["metrics"]),
            "metrics must be a nonempty object", provenance_path)
    validate_nonblank(provenance["source_url"], "source_url", provenance_path, None)
    require({item["sequence_id"] for item in annotations} == set(research),
            "Unmatched research annotations", annotation_path)
    metrics = sorted(provenance["metrics"])
    for metric, metadata in provenance["metrics"].items():
        required_keys(metadata, {"unit"}, provenance_path, metric)
        validate_nonblank(metadata["unit"], "unit", provenance_path, metric)
        require(metric in metric_units, "No unit mapping for research metric", provenance_path, metric)
        require(metadata["unit"] == metric_units[metric], "Research unit conflicts with metric mapping",
                provenance_path, metric)
    hvac_inputs, hvac_labels = [], []
    for annotation in annotations:
        required_keys(annotation, {"sequence_id", "reading_count", "source_row_count", "source_fault_class",
                                   "sensor_bias_delta_c"}, annotation_path, annotation.get("sequence_id", "unknown"))
        validate_nonblank(annotation["sequence_id"], "sequence_id", annotation_path, annotation["sequence_id"])
        validate_nonblank(annotation["source_fault_class"], "source_fault_class", annotation_path, annotation["sequence_id"])
        annotation["reading_count"] = validate_integer(annotation["reading_count"], "reading_count", annotation_path, annotation["sequence_id"], minimum=1)
        annotation["source_row_count"] = validate_integer(annotation["source_row_count"], "source_row_count", annotation_path, annotation["sequence_id"], minimum=1)
        seq = annotation["sequence_id"]
        require(seq in research, "Annotation has no matching telemetry sequence", annotation_path, seq)
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
