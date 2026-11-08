"""Extract two matched windows from the official LBNL chiller-plant ZIP."""
import argparse
import csv
import io
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://doi.org/10.25984/1881324"
SOURCE_ZONE = timezone(timedelta(hours=-6))
START = datetime(2018, 7, 16, 14, 0)
MINUTES = 120
SEQUENCES = (
    ("LBNL-7C4A", "ChillerPlant.csv", "fault_free", None),
    ("LBNL-2E91", "ChillerPlant_chiller_bias_-2.csv", "chiller_1_leaving_water_temperature_sensor_bias", -2),
)
# raw column, metric, original unit, normalized unit
METRICS = (
    ("CHL_SW_TEMP_1", "chilled_water_supply_temp_c", "degF", "Cel"),
    ("CHL_RW_TEMP_1", "chilled_water_return_temp_c", "degF", "Cel"),
    ("CHL_POW_1", "chiller_power_kw", "kW", "kW"),
    ("CHL_STA_1", "chiller_on", "0/1", "1"),
)
FIELDS = ("reading_id", "component_id", "metric_name", "value", "timestamp")


def source_datetime_to_utc_ms(value):
    """Apply the unverified fixed standard-time policy, independent of host TZ."""
    if value.tzinfo is not None:
        raise ValueError("Expected timezone-naive source Datetime")
    return int(value.replace(tzinfo=SOURCE_ZONE).timestamp()) * 1000


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2, allow_nan=False, ensure_ascii=False) + "\n", encoding="utf-8")


def write_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def normalize(archive_path):
    data = ROOT / "data" / "processed"
    # Preserve the reviewed policy and citations when reproducing the extract.
    # Fail before writing anything if the policy no longer matches this converter.
    timestamp_policy = json.loads((data / "hvac_provenance.json").read_text(encoding="utf-8"))["timestamp"]
    if (timestamp_policy["assumed_offset"] != "-06:00" or
            timestamp_policy["interpretation"] != "fixed_standard_time" or
            timestamp_policy["daylight_saving_adjustment_applied"] is not False):
        raise ValueError("Timestamp policy changed; review the conversion before regenerating")
    data.mkdir(parents=True, exist_ok=True)
    annotations = []
    readings = []
    end = START + timedelta(minutes=MINUTES)
    with ZipFile(archive_path) as archive:
        for sequence, member, fault, bias in SEQUENCES:
            source_times = []
            info = archive.getinfo(member)
            with archive.open(info) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as stream:
                rows = csv.DictReader(stream)
                if not {"Datetime", *(item[0] for item in METRICS)}.issubset(rows.fieldnames or ()):
                    raise ValueError(f"{member}: missing required columns")
                for row in rows:
                    time = datetime.fromisoformat(row["Datetime"])
                    if time >= end:
                        break
                    if time < START:
                        continue
                    if time != START + timedelta(minutes=len(source_times)):
                        raise ValueError(f"{member}: gap or duplicate at {time}")
                    source_times.append(time)
                    timestamp = source_datetime_to_utc_ms(time)
                    for column, name, original_unit, _ in METRICS:
                        value = float(row[column])
                        if not math.isfinite(value):
                            raise ValueError(f"{member}: non-finite {column} at {time}")
                        if name == "chiller_on" and value not in (0, 1):
                            raise ValueError(f"{member}: invalid status at {time}")
                        if original_unit == "degF":
                            value = (value - 32) * 5 / 9
                        readings.append(dict(
                            reading_id=f"{sequence}-{len(source_times):03}-{name}",
                            component_id="COMP-CH-01", metric_name=name,
                            value=round(value, 6), timestamp=timestamp,
                        ))
            if len(source_times) != MINUTES:
                raise ValueError(f"{member}: expected {MINUTES} rows, got {len(source_times)}")
            annotations.append(dict(
                sequence_id=sequence, source_archive_member=member,
                source_member_zip_crc32=f"{info.CRC:08x}", source_fault_class=fault,
                sensor_bias_delta_c=bias, source_datetime_start=source_times[0].isoformat(),
                source_datetime_end_inclusive=source_times[-1].isoformat(),
                source_datetimes_have_explicit_timezone=False, timestamp_assumed_offset="-06:00",
                source_row_count=len(source_times), reading_count=len(source_times) * len(METRICS),
            ))
    readings.sort(key=lambda row: (row["timestamp"], row["reading_id"]))
    write_csv(data / "hvac_readings.csv", FIELDS, readings)
    write_json(data / "hvac_fault_annotations.json", {
        "schema_version": "1.0", "source_id": "lbnl_chiller_plant", "source_url": SOURCE_URL,
        "join": "Join sequence_id to the first two hyphen-delimited tokens of reading_id.",
        "sequences": sorted(annotations, key=lambda item: item["sequence_id"]),
    })
    write_json(data / "hvac_provenance.json", {
        "schema_version": "1.0", "source_id": "lbnl_chiller_plant", "source_url": SOURCE_URL,
        "source_kind": "research_simulation", "license": "CC BY 4.0", "sample_interval_seconds": 60,
        "component_crosswalk": {"COMP-CH-01": "LBNL simulated Chiller 1"},
        "timestamp": timestamp_policy,
        "metrics": {
            name: {
                "source_column": column, "source_unit": original, "unit": unit,
                "conversion": "(x - 32) * 5 / 9" if original == "degF" else "identity",
            }
            for column, name, original, unit in METRICS
        },
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    normalize(parser.parse_args().zip_path)
