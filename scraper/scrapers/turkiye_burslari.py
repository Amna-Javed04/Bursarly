"""
Türkiye Bursları (Turkey Scholarships) Scraper
Official URL: https://www.turkiyeburslari.gov.tr/en

Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must be under 21 years old for Bachelor's, under 30 for Master's, and under 35 for PhD programs.",
    "Minimum academic achievement: 70% for Bachelor's, 75% for Master's/PhD, and 90% for Medical Sciences.",
    "Citizens of Turkey or those who have lost Turkish citizenship are not eligible to apply.",
    "Applicants currently enrolled in a Turkish institution at the same level of study cannot apply.",
    "Applicants must not already be a Türkiye Bursları scholarship holder.",
    "Applicants must demonstrate motivation and a connection to Turkey or Turkish studies (preferred).",
]

CURATED_DOCUMENTS = [
    "Valid Passport or National ID",
    "Recent Photograph",
    "Academic Transcripts (all completed levels)",
    "Graduation / Degree Certificates",
    "Letter of Intent (motivation letter)",
    "Reference Letters (2)",
    "National or International Exam Results (if available — e.g. SAT, GRE)",
    "Language Proficiency Certificate (if available)",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2027-02-20", "deadline_type": "General Application Deadline (typically Feb)"},
]


class TurkiyeBurslarScraper(BaseScholarshipScraper):
    name = "Türkiye Bursları (Turkey Scholarships)"
    slug = "turkiye_burslari"
    official_url = "https://www.turkiyeburslari.gov.tr/en"

    DEADLINE_PAGES = [
        "https://www.turkiyeburslari.gov.tr/en",
        "https://www.turkiyeburslari.gov.tr/en/basvuru/basvuru-kilavuzu",
    ]

    def scrape(self) -> dict:
        self.log.info("Starting Türkiye Bursları scraper (deadline extraction only)...")
        combined_text = ""

        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url)
            if not resp:
                self.log.warning("Could not fetch %s — skipping", url)
                continue
            text = html_to_clean_text(resp.text)
            slug = url.rstrip("/").split("/")[-1] or "home"
            self.save_raw(f"{slug}_raw.html", resp.text)
            self.save_raw(f"{slug}_text.txt", text)
            combined_text += "\n\n" + text

        deadlines = self._parse_deadlines(combined_text)
        self.log.info("Using verified curated eligibility and documents.")

        return {
            "name": self.name,
            "country": "Turkey",
            "degree_level": "Bachelor's / Master's / PhD",
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
            r"(?i)(?:application|başvuru)[^\n]*?(\d{1,2}[./]\d{1,2}[./]\d{4})",
            r"(?i)(\w+\s+\d{1,2},?\s*\d{4})[^\n]*?deadline",
        ]
        found = set()
        for pattern in patterns:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "General Application Deadline"})

        if not deadlines:
            self.log.warning("No Türkiye Bursları deadlines parsed — using verified estimates")
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
