"""
DAAD EPOS Scholarship Scraper
Official URL: https://www.daad.de/en/information-services-for-higher-education-institutions/further-information-on-daad-programmes/epos/

Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must be a graduate from a qualifying developing or newly industrialized country.",
    "Must have a Bachelor's degree in a related subject area (typically a four-year program) with above-average results.",
    "Must have at least two years of relevant professional work experience after completing Bachelor's degree.",
    "Academic degrees should normally not be older than six years.",
    "Must demonstrate a strong commitment to home country's development.",
    "Must show proficiency in English or German (language of instruction).",
]

CURATED_DOCUMENTS = [
    "DAAD Application Form (from university or portal)",
    "Letter of Motivation (max. 2 pages, signed)",
    "Curriculum Vitae / CV (Europass format preferred, in reverse chronological order)",
    "University Certificate & Transcripts (officially certified copies)",
    "Proof of at least 2 years of relevant professional experience (work certificate)",
    "Letter of Recommendation from current employer (on headed paper, stamped & signed)",
    "Language Certificate (IELTS, TOEFL, or TestDaF/German language certificate)",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2026-10-31", "deadline_type": "EPOS Application Deadline (set by individual universities — typically Aug–Oct)"},
]


class DAADScraper(BaseScholarshipScraper):
    name = "DAAD Scholarships for Development (EPOS)"
    slug = "daad"
    official_url = "https://www.daad.de/en/information-services-for-higher-education-institutions/further-information-on-daad-programmes/epos/"

    DEADLINE_PAGES = [
        "https://www.daad.de/en/information-services-for-higher-education-institutions/further-information-on-daad-programmes/epos/",
    ]

    def scrape(self) -> dict:
        self.log.info("Starting DAAD scraper (deadline extraction only)...")
        combined_text = ""

        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url)
            if not resp:
                self.log.warning("Could not fetch %s — skipping", url)
                continue
            text = html_to_clean_text(resp.text)
            self.save_raw("epos_raw.html", resp.text)
            self.save_raw("epos_text.txt", text)
            combined_text += "\n\n" + text

        deadlines = self._parse_deadlines(combined_text)
        self.log.info("Using verified curated eligibility and documents.")

        return {
            "name": self.name,
            "country": "Germany",
            "degree_level": "Master's & PhD",
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
            r"(?i)(\d{1,2}[./]\d{1,2}[./]\d{4})[^\n]*?deadline",
            r"(?i)apply by[^\n]*?(\w+\s+\d{1,2},?\s*\d{4})",
        ]
        found = set()
        for pattern in patterns:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "DAAD EPOS Application Deadline"})

        if not deadlines:
            self.log.warning("No DAAD deadlines parsed — using verified estimates")
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
