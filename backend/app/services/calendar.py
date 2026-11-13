"""
calendar.py — generate an iCalendar (.ics) file for a scholarship's deadlines.

Only deadlines confirmed against the official source are exported: an exported
calendar entry is a promise that the date is real, so estimated dates are
deliberately excluded.
"""

from datetime import datetime, timedelta
from typing import Iterable, List

from app import models


def _escape(value: str) -> str:
    """Escapes text for an ICS property (RFC 5545)."""
    return (
        (value or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str, limit: int = 73) -> str:
    """Folds long content lines, as required by RFC 5545."""
    if len(line) <= limit:
        return line
    chunks = [line[:limit]]
    rest = line[limit:]
    while rest:
        chunks.append(" " + rest[: limit - 1])
        rest = rest[limit - 1:]
    return "\r\n".join(chunks)


def build_scholarship_calendar(scholarship: models.Scholarship) -> str:
    """Returns an ICS document for the scholarship's confirmed future deadlines."""
    now = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines: List[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bursarly//Scholarship Deadlines//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(scholarship.name)}",
    ]

    deadlines = get_confirmed_deadlines(scholarship)
    for deadline in deadlines:
        day = deadline.deadline_date
        description = f"Application deadline for {scholarship.name}."
        if scholarship.official_url:
            description += f" Official source: {scholarship.official_url}"
        description += " Date verified against the official source by Bursarly."

        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{deadline.id}@bursarly",
                f"DTSTAMP:{now}",
                f"DTSTART;VALUE=DATE:{day.strftime('%Y%m%d')}",
                f"DTEND;VALUE=DATE:{(day + timedelta(days=1)).strftime('%Y%m%d')}",
                _fold(f"SUMMARY:{_escape(scholarship.name)} — application deadline"),
                _fold(f"DESCRIPTION:{_escape(description)}"),
            ]
        )
        if scholarship.official_url:
            lines.append(_fold(f"URL:{_escape(scholarship.official_url)}"))
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def get_confirmed_deadlines(scholarship: models.Scholarship) -> Iterable[models.ScholarshipDeadline]:
    """Confirmed, not-yet-passed deadlines in chronological order."""
    from datetime import date

    today = date.today()
    return sorted(
        [
            d
            for d in scholarship.deadlines
            if not d.is_estimated and d.deadline_date >= today
        ],
        key=lambda d: d.deadline_date,
    )
