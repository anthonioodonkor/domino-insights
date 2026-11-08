"""Read-only regression checks; never run normalization or replay."""
import csv
import json
import unittest
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from normalize_lbnl import ROOT, source_datetime_to_utc_ms


class TimestampConventionTest(unittest.TestCase):
    def test_summer_standard_versus_chicago_civil_time(self):
        source = datetime(2018, 7, 16, 14, 0)
        standard_ms = source_datetime_to_utc_ms(source)
        civil = source.replace(tzinfo=ZoneInfo("America/Chicago"))
        self.assertEqual(civil.utcoffset(), timedelta(hours=-5))
        civil_ms = int(civil.timestamp()) * 1000
        self.assertEqual(standard_ms, 1531771200000)  # 20:00 UTC
        self.assertEqual(civil_ms, 1531767600000)  # 19:00 UTC
        self.assertEqual(standard_ms - civil_ms, 3_600_000)
        self.assertIsNone(source.tzinfo)  # Original source value is untouched.

    def test_fixed_offset_is_year_round_and_rejects_aware_input(self):
        for month in (1, 7, 11):
            source = datetime(2018, month, 16, 14, 0)
            expected = datetime(2018, month, 16, 20, 0, tzinfo=timezone.utc)
            self.assertEqual(source_datetime_to_utc_ms(source), int(expected.timestamp()) * 1000)
        with self.assertRaisesRegex(ValueError, "timezone-naive"):
            source_datetime_to_utc_ms(datetime(2018, 7, 16, tzinfo=timezone.utc))

    def test_each_stored_sequence_matches_source_conversion_and_minute_cadence(self):
        data = ROOT / "data" / "processed"
        provenance = json.loads((data / "hvac_provenance.json").read_text())
        policy = provenance["timestamp"]
        self.assertEqual(policy["verification_status"], "unverified")
        self.assertEqual(policy["assumed_offset"], "-06:00")
        self.assertFalse(policy["daylight_saving_adjustment_applied"])
        annotations = json.loads((data / "hvac_fault_annotations.json").read_text())
        with (data / "hvac_readings.csv").open(newline="") as stream:
            rows = list(csv.DictReader(stream))
        for sequence in annotations["sequences"]:
            with self.subTest(sequence=sequence["sequence_id"]):
                selected = [r for r in rows if r["reading_id"].startswith(sequence["sequence_id"] + "-")]
                self.assertEqual(len(selected), 480)
                times = sorted({int(r["timestamp"]) for r in selected})
                self.assertEqual(len(times), 120)
                start = datetime.fromisoformat(sequence["source_datetime_start"])
                expected = [source_datetime_to_utc_ms(start + timedelta(minutes=i)) for i in range(120)]
                self.assertEqual(times, expected)
                self.assertTrue(all(b - a == 60_000 for a, b in zip(times, times[1:])))
                self.assertEqual(times[-1], source_datetime_to_utc_ms(
                    datetime.fromisoformat(sequence["source_datetime_end_inclusive"])))


if __name__ == "__main__":
    unittest.main()
