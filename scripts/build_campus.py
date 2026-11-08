"""Generate the fictional campus and its deterministic cooling replay."""
from datetime import datetime, timezone

from normalize_lbnl import FIELDS, ROOT, write_csv, write_json

START = int(datetime(2026, 7, 16, 19, tzinfo=timezone.utc).timestamp() * 1000)
SCENARIO = "SC-COOL-01"
SYNTHETIC = ROOT / "data" / "synthetic"
ASSETS = (
    ("COMP-CH-01", "hvac", "chiller", "Primary chiller"),
    ("COMP-CH-02", "hvac", "chiller", "Standby chiller"),
    ("COMP-AHU-01", "hvac", "air_handler", "Server hall air handler"),
    ("COMP-AHU-02", "hvac", "air_handler", "Office air handler"),
    ("COMP-PMP-01", "hvac", "cooling_pump", "Primary chilled-water pump"),
    ("COMP-PMP-02", "hvac", "cooling_pump", "Standby chilled-water pump"),
    ("COMP-UPS-01", "utilities", "ups", "Server hall UPS"),
    ("COMP-PNL-01", "utilities", "electrical_panel", "Plant electrical panel"),
    ("COMP-PNL-02", "utilities", "electrical_panel", "Critical loads electrical panel"),
    ("COMP-GEN-01", "utilities", "generator", "Standby generator"),
    ("COMP-DR-01", "access_control", "door_controller", "Primary plant access controller"),
    ("COMP-DR-02", "access_control", "door_controller", "Escorted plant access controller"),
    ("COMP-BR-01", "access_control", "badge_reader", "Primary plant badge reader"),
    ("COMP-BR-02", "access_control", "badge_reader", "Alternate plant badge reader"),
    ("COMP-DSP-01", "facilities", "dispatch_service", "Facilities dispatch"),
    ("COMP-HALL-01", "hvac", "conditioned_space", "Server hall"),
    ("COMP-OFC-01", "hvac", "conditioned_space", "Office floor"),
)
DEPENDENCIES = (
    ("COMP-CH-01", "COMP-AHU-01", "primary_cooling"),
    ("COMP-CH-02", "COMP-AHU-01", "standby_cooling_operator_approval"),
    ("COMP-PMP-01", "COMP-CH-01", "chilled_water_flow"),
    ("COMP-PMP-02", "COMP-CH-02", "standby_water_flow"),
    ("COMP-PNL-01", "COMP-CH-01", "normal_power"),
    ("COMP-PNL-01", "COMP-CH-02", "normal_power"),
    ("COMP-PNL-01", "COMP-PMP-01", "normal_power"),
    ("COMP-PNL-01", "COMP-PMP-02", "normal_power"),
    ("COMP-PNL-02", "COMP-UPS-01", "normal_power"),
    ("COMP-GEN-01", "COMP-PNL-02", "standby_power"),
    ("COMP-UPS-01", "COMP-HALL-01", "protected_it_power"),
    ("COMP-AHU-01", "COMP-HALL-01", "conditioned_air"),
    ("COMP-AHU-02", "COMP-OFC-01", "conditioned_air"),
    ("COMP-DR-01", "COMP-BR-01", "reader_control"),
    ("COMP-DR-02", "COMP-BR-02", "reader_control"),
    ("COMP-BR-01", "COMP-DSP-01", "primary_maintenance_access"),
    ("COMP-BR-02", "COMP-DSP-01", "alternate_access_requires_escort"),
)
LEASES = (
    ("TEN-01", "Cobalt Finch Compute", "COMP-HALL-01", 27, 3, 60000),
    ("TEN-02", "Juniper Stack Labs", "COMP-HALL-01", 29, 2, 30000),
    ("TEN-03", "Aster Paper Studio", "COMP-OFC-01", 28, 3, 12000),
)
SUPPLY = [6.7, 6.7, 6.8, 7.5, 8.4, 9.6, 10.6, 11.5, 12.1, 12.5, 12.9, 13.0, 13.1, 13.0, 12.9, 12.8, 12.8, 12.7, 12.7, 12.6]
HALL = [23.0, 23.1, 23.1, 23.3, 23.7, 24.5, 25.6, 26.5, 27.2, 27.9, 28.5, 28.8, 28.4, 27.7, 26.9, 25.9, 24.7, 24.0, 23.5, 23.2]
AIR = [16.0, 16.0, 16.1, 16.6, 17.2, 18.1, 18.9, 19.8, 20.6, 21.1, 21.5, 19.8, 18.4, 17.2, 16.6, 16.2, 16.1, 16.0, 16.0, 16.0]


def timestamp(minute):
    return START + minute * 60_000


def telemetry(rows, minute, component, metric, value):
    rows.append(dict(
        reading_id=f"{SCENARIO}-{minute:02}-{component}-{metric}", component_id=component,
        metric_name=metric, value=round(value, 2), timestamp=timestamp(minute),
    ))


def event(n, minute, component, silo, kind, **details):
    return dict(
        event_id=f"EV-{n:02}", scenario_id=SCENARIO, timestamp=timestamp(minute),
        component_id=component, silo=silo, event_type=kind, source_kind="synthetic", details=details,
    )


def build():
    write_csv(SYNTHETIC / "assets.csv", ["component_id", "silo", "asset_type", "name", "source_kind"],
              [dict(zip(("component_id", "silo", "asset_type", "name", "source_kind"), (*asset, "synthetic"))) for asset in ASSETS])
    write_csv(SYNTHETIC / "dependencies.csv", ["upstream_component_id", "downstream_component_id", "relation", "source_kind"],
              [dict(zip(("upstream_component_id", "downstream_component_id", "relation", "source_kind"), (*edge, "synthetic"))) for edge in DEPENDENCIES])
    lease_fields = ("tenant_id", "tenant_name", "service_component_id", "threshold_c", "grace_minutes", "rate_cents_per_hour", "currency", "source_kind")
    write_csv(SYNTHETIC / "tenant_leases.csv", lease_fields,
              [dict(zip(lease_fields, (*lease, "USD", "synthetic"))) for lease in LEASES])

    hvac = []
    utility = []
    for minute, (supply, hall, air) in enumerate(zip(SUPPLY, HALL, AIR, strict=True)):
        telemetry(hvac, minute, "COMP-CH-01", "chilled_water_supply_temp_c", supply)
        telemetry(hvac, minute, "COMP-CH-01", "chilled_water_return_temp_c", 12.2 + 0.55 * (supply - 6.7))
        telemetry(hvac, minute, "COMP-CH-01", "chiller_load_pct", min(100, 62 + 6.5 * (supply - 6.7)))
        telemetry(hvac, minute, "COMP-CH-01", "chiller_power_kw", 141 + 5 * (supply - 6.7))
        telemetry(hvac, minute, "COMP-CH-02", "chiller_on", int(minute >= 11))
        telemetry(hvac, minute, "COMP-CH-02", "chilled_water_supply_temp_c",
                  12.2 if minute < 11 else [8.2, 7.2, 6.9][min(2, minute - 11)])
        telemetry(hvac, minute, "COMP-AHU-01", "supply_air_temp_c", air)
        telemetry(hvac, minute, "COMP-HALL-01", "zone_temp_c", hall)
        telemetry(hvac, minute, "COMP-OFC-01", "zone_temp_c", 23.4 + (minute % 3) * 0.1)
        telemetry(utility, minute, "COMP-PNL-01", "electric_demand_kw", 410 + 5 * (supply - 6.7) + 124 * (minute >= 11))
        telemetry(utility, minute, "COMP-PNL-02", "line_voltage_v", 480 + [0, 1, 0, -1][minute % 4])
        telemetry(utility, minute, "COMP-UPS-01", "ups_charge_pct", 99.2)
        telemetry(utility, minute, "COMP-GEN-01", "generator_on", 0)
    events = [
        event(1, 0, "COMP-HALL-01", "hvac", "baseline_checked"),
        event(2, 3, "COMP-CH-01", "hvac", "cooling_degradation_started"),
        event(3, 5, "COMP-AHU-01", "hvac", "cooling_capacity_degraded", upstream_event_id="EV-02"),
        event(4, 6, "COMP-DSP-01", "facilities", "work_order_assigned", work_order_id="WO-01",
              technician_id="TECH-01", assigned_to_asset_id="COMP-CH-01", upstream_event_id="EV-03"),
        event(5, 7, "COMP-DR-01", "access_control", "controller_unavailable", cause="independent_maintenance_link_fault"),
        event(6, 8, "COMP-BR-01", "access_control", "maintenance_access_check_failed",
              fabricated_badge_id="DEMO-BADGE-01", work_order_id="WO-01", upstream_event_id="EV-05"),
        event(7, 8, "COMP-HALL-01", "lease_contracts", "tenant_at_risk", tenant_ids=["TEN-01", "TEN-02"],
              threshold_exceeded_tenant_ids=["TEN-01"]),
        event(8, 9, "COMP-BR-02", "access_control", "escorted_entry_authorized",
              fabricated_badge_id="DEMO-BADGE-01", work_order_id="WO-01", upstream_event_id="EV-06"),
        event(9, 10, "COMP-DSP-01", "facilities", "work_order_on_site", work_order_id="WO-01",
              technician_id="TECH-01", elapsed_since_assignment_minutes=4, upstream_event_id="EV-08"),
        event(10, 11, "COMP-CH-02", "hvac", "backup_cooling_approved_and_started",
              operator_id="DEMO-OP-01", pump_component_id="COMP-PMP-02", upstream_event_id="EV-09"),
        event(11, 11, "COMP-PNL-01", "utilities", "load_increased_after_backup_start", upstream_event_id="EV-10"),
        event(12, 14, "COMP-HALL-01", "lease_contracts", "threshold_excursion_ended", tenant_ids=["TEN-01"]),
        event(13, 17, "COMP-DR-01", "access_control", "controller_restored"),
        event(14, 19, "COMP-HALL-01", "hvac", "recovery_verified", upstream_event_id="EV-10"),
        event(15, 19, "COMP-DSP-01", "facilities", "work_order_resolved", work_order_id="WO-01", upstream_event_id="EV-14"),
    ]
    ordered = sorted([*hvac, *utility], key=lambda row: (row["timestamp"], row["reading_id"]))
    write_csv(SYNTHETIC / "utility_readings.csv", FIELDS, utility)
    write_json(SYNTHETIC / "operational_events.json", events)
    write_json(ROOT / "data/scenarios/cooling_cascade.json", {
        "schema_version": "1.0", "scenario_id": SCENARIO, "source_kind": "synthetic",
        "timestamp_start": START, "sample_interval_seconds": 60,
        "phases": [
            {"phase": "normal", "start_minute": 0, "end_minute_exclusive": 3},
            {"phase": "fault", "start_minute": 3, "end_minute_exclusive": 11},
            {"phase": "recovery", "start_minute": 11, "end_minute_exclusive": 20},
        ],
        "telemetry": ordered, "operational_event_ids": [item["event_id"] for item in events],
    })


if __name__ == "__main__":
    build()
