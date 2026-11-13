"""Tests for the .ics export: only confirmed, future deadlines may be exported."""

import os
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.services.calendar import build_scholarship_calendar, get_confirmed_deadlines  # noqa: E402


def make_deadline(when: date, estimated: bool = False):
    return SimpleNamespace(id=uuid4(), deadline_date=when, is_estimated=estimated, deadline_type="Application deadline")


def make_scholarship(deadlines, name="Test Scholarship", url="https://example.org/apply"):
    return SimpleNamespace(id=uuid4(), name=name, official_url=url, deadlines=deadlines)


class CalendarTests(unittest.TestCase):
    def test_estimated_dates_are_excluded(self):
        future = date.today() + timedelta(days=30)
        scholarship = make_scholarship([make_deadline(future, estimated=True)])
        self.assertEqual(list(get_confirmed_deadlines(scholarship)), [])
        self.assertNotIn("BEGIN:VEVENT", build_scholarship_calendar(scholarship))

    def test_past_dates_are_excluded(self):
        past = date.today() - timedelta(days=2)
        scholarship = make_scholarship([make_deadline(past)])
        self.collection_empty = list(get_confirmed_deadlines(scholarship))
        self.assertEqual(self.collection_empty, [])

    def test_confirmed_future_date_is_exported(self):
        future = date.today() + timedelta(days=21)
        scholarship = make_scholarship([make_deadline(future)])
        calendar = build_scholarship_calendar(scholarship)
        self.assertIn("BEGIN:VCALENDAR", calendar)
        self.assertIn("BEGIN:VEVENT", calendar)
        self.assertIn(f"DTSTART;VALUE=DATE:{future.strftime('%Y%m%d')}", calendar)
        self.assertIn("https://example.org/apply", calendar.replace("\\,", ","))
        # RFC 5545 requires CRLF line endings.
        self.assertIn("\r\n", calendar)

    def test_commas_and_semicolons_are_escaped(self):
        future = date.today() + timedelta(days=10)
        scholarship = make_scholarship([make_deadline(future)], name="Test, Scholarship; Fund")
        calendar = build_scholarship_calendar(scholarship)
        self.assertIn("Test\\, Scholarship\\; Fund", calendar)


if __name__ == "__main__":
    unittest.main()
