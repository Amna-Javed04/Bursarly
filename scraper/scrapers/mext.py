"""
MEXT (Japan Government Scholarship) Scraper
Official URL: https://www.mext.go.jp/en/policy/education/highered/title02/detail02/sdetail02/1373897.htm

Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must be a citizen of a country that has diplomatic relations with Japan.",
    "Graduate (Research Student): Must be under 35 years of age at the time of application.",
    "Undergraduate: Must be under 24 years of age at the time of application.",
    "Must meet the academic requirements (GPA equivalent to Japanese university standards).",
    "Must be willing to study the Japanese language and adapt to life in Japan.",
    "Must be in good health, confirmed by a physical examination.",
    "Applicants must not currently be enrolled in a Japanese university or receiving another Japanese government scholarship.",
]

CURATED_DOCUMENTS = [
    "MEXT Application Form (provided by Embassy)",
    "Placement Preference Application Form (Graduate only)",
    "Field of Study and Research Plan (Graduate only — detailed academic proposal)",
    "Official Academic Transcripts",
    "Graduation / Degree Certificate",
    "Recommendation Letter from Dean, Head of Department, or Academic Advisor",
    "Certificate of Health (physical examination form provided by Embassy)",
    "Abstract of Thesis (if applicable, for research students)",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2027-06-10", "deadline_type": "Embassy Recommendation Track Deadline (estimated — varies by country)"},
]


class MEXTScraper(BaseScholarshipScraper):
    name = "MEXT Japanese Government Scholarship"
    slug = "mext"
    official_url = "https://www.mext.go.jp/en/policy/education/highered/title02/detail02/sdetail02/1373897.htm"

    DEADLINE_PAGES = [
        "https://www.mext.go.jp/en/policy/education/highered/title02/detail02/sdetail02/1373897.htm",
    ]

    def scrape(self) -> dict:
        self.log.info("Starting MEXT scraper (deadline extraction only)...")
        combined_text = ""

        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url, timeout=40)
            if not resp:
                self.log.warning("Could not fetch %s — skipping", url)
                continue
            text = html_to_clean_text(resp.text)
            self.save_raw("main_raw.html", resp.text)
            self.save_raw("main_text.txt", text)
            combined_text += "\n\n" + text

        deadlines = self._parse_deadlines(combined_text)
        self.log.info("Using verified curated eligibility and documents.")

        return {
            "name": self.name,
            "country": "Japan",
            "degree_level": "Undergraduate & Graduate",
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
            r"(?i)embassy[^\n]*?(\w+\s+\d{1,2},?\s*\d{4})",
            r"(?i)application[^\n]*?(\d{1,2}\s+\w+\s+\d{4})",
        ]
        found = set()
        for pattern in patterns:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "Embassy Recommendation Track Deadline"})

        if not deadlines:
            self.log.warning("No MEXT deadlines parsed — using verified estimates")
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
