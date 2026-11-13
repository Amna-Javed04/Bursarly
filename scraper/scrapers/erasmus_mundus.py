"""
Erasmus Mundus Joint Master Degrees (EMJMD) Scraper
Official URL: https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters

Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must have completed a Bachelor's degree or equivalent (or be in the final year of studies).",
    "Must not have previously received an Erasmus Mundus Joint Master Degree scholarship.",
    "Open to students from EU program countries and international partner countries (rest of the world).",
    "Each consortium sets its own additional entry requirements — check the specific programme's website.",
    "Must meet the language requirements of the specific programme (usually English).",
    "Some programmes have GPA or work experience requirements specific to their field.",
]

CURATED_DOCUMENTS = [
    "Bachelor's Degree Certificate (or proof of expected completion)",
    "Official Academic Transcripts",
    "Two Letters of Recommendation",
    "Motivation Letter",
    "CV (Europass Format preferred)",
    "English Language Certificate (IELTS/TOEFL — minimum varies by programme)",
    "Valid Passport / ID",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2027-01-15", "deadline_type": "Joint Programme Application Deadline (varies by consortium — typically Nov–Jan)"},
]


class ErasmusMundusScraper(BaseScholarshipScraper):
    name = "Erasmus Mundus Joint Master Degrees (EMJMD)"
    slug = "erasmus_mundus"
    official_url = "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters"

    DEADLINE_PAGES = [
        "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters",
    ]

    def scrape(self) -> dict:
        self.log.info("Starting Erasmus Mundus scraper (deadline extraction only)...")
        combined_text = ""

        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url, timeout=40)
            if not resp:
                self.log.warning("Could not fetch %s — skipping", url)
                continue
            text = html_to_clean_text(resp.text)
            self.save_raw("students_raw.html", resp.text)
            self.save_raw("students_text.txt", text)
            combined_text += "\n\n" + text

        deadlines = self._parse_deadlines(combined_text)
        self.log.info("Using verified curated eligibility and documents.")

        return {
            "name": self.name,
            "country": "European Union",
            "degree_level": "Master's",
            "funding_type": "Full Funding",
            "official_url": self.official_url,
            "deadlines": deadlines,
            "documents": CURATED_DOCUMENTS,
            "eligibility": CURATED_ELIGIBILITY,
            "raw_text": combined_text,
        }

    def _parse_deadlines(self, text: str) -> list:
        deadlines = []
        patterns = [
            r"(?i)deadline[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})",
            r"(?i)(\w+\s+\d{1,2},?\s*\d{4})[^\n]*?deadline",
            r"(?i)apply by[^\n]*?(\d{1,2}\s+\w+\s+\d{4})",
        ]
        found = set()
        for pattern in patterns:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "Joint Programme Application Deadline"})

        if not deadlines:
            self.log.warning("No Erasmus Mundus deadlines parsed — using verified estimates")
            return CURATED_DEADLINES_FALLBACK
        return deadlines


def _try_parse_date(raw: str) -> Optional[date]:
    try:
        import dateparser
        parsed = dateparser.parse(raw, settings={"PREFER_DATES_FROM": "future"})
        if parsed:
            return parsed.date()
    except Exception:
        pass
    return None
