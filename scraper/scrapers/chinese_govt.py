"""
Chinese Government Scholarship (CSC) Scraper
Official URL: https://www.csc.edu.cn/laihua
Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must be a non-Chinese citizen in good physical and mental health.",
    "Must be under 25 years old for Bachelor's, under 35 for Master's, under 40 for PhD.",
    "Must hold relevant academic qualification for the level applied.",
    "Must not be currently enrolled in a Chinese university.",
    "Must be from a country with diplomatic relations with China.",
]

CURATED_DOCUMENTS = [
    "Valid Passport (non-Chinese)", "Notarized Highest Degree Certificate",
    "Notarized Academic Transcripts", "Study Plan / Research Proposal",
    "Two Letters of Recommendation from Professors or Employers",
    "Physical Examination Record for Foreigners (official form)",
    "HSK Language Certificate (required for Chinese-medium programs)",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2027-03-31", "deadline_type": "Embassy Track Application Deadline (typically Jan–Apr)"},
]


class ChineseGovtScraper(BaseScholarshipScraper):
    name = "Chinese Government Scholarship (CSC)"
    slug = "chinese_govt"
    official_url = "https://www.csc.edu.cn/laihua"
    DEADLINE_PAGES = ["https://www.csc.edu.cn/laihua"]

    def scrape(self) -> dict:
        self.log.info("Starting CSC scraper (deadline extraction only)...")
        combined_text = ""
        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url, timeout=40)
            if resp:
                text = html_to_clean_text(resp.text)
                self.save_raw("main_raw.html", resp.text)
                self.save_raw("main_text.txt", text)
                combined_text += "\n\n" + text
            else:
                self.log.warning("Could not fetch %s — using curated data", url)
        return {
            "name": self.name, "country": "China",
            "degree_level": "Bachelor's / Master's / PhD",
            "funding_type": "Full Funding", "official_url": self.official_url,
            "deadlines": self._parse_deadlines(combined_text),
            "documents": CURATED_DOCUMENTS, "eligibility": CURATED_ELIGIBILITY,
            "raw_text": combined_text,
        }

    def _parse_deadlines(self, text: str) -> list:
        deadlines = []
        found = set()
        for pattern in [r"(?i)deadline[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})", r"(?i)apply by[^\n]*?(\w+\s+\d{1,2},?\s*\d{4})"]:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "CSC Application Deadline"})
        return deadlines or CURATED_DEADLINES_FALLBACK


def _try_parse_date(raw: str) -> Optional[date]:
    try:
        import dateparser
        parsed = dateparser.parse(raw, settings={"PREFER_DATES_FROM": "future"})
        if parsed:
            return parsed.date()
    except Exception:
        pass
    return None
