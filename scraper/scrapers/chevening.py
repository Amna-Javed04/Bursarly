"""
Chevening Scholarships Scraper
Official URL: https://www.chevening.org/scholarships/
Strategy: Live scrape for deadlines only. Eligibility and documents use verified curated data.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

CURATED_ELIGIBILITY = [
    "Must be a citizen of a Chevening-eligible country or territory.",
    "Must have at least 2 years of work experience (2,800 hours) in any sector.",
    "Must hold an undergraduate degree equivalent to a UK upper second class (2:1) honours degree.",
    "Must apply to three different eligible UK universities (unconditional offer required before interview).",
    "Must intend to return to your home country for a minimum of 2 years after the scholarship ends.",
    "Must not hold or be applying for another fully-funded scholarship for the same period.",
    "Must meet the English language requirements (IELTS/TOEFL — submitted after shortlisting).",
]

CURATED_DOCUMENTS = [
    "University Degree Certificate and Transcripts",
    "Two Chevening References (online, from referees)",
    "Four Chevening Essays (Leadership, Networking, Career Plan, Chevening Choice)",
    "English Language Certificate (IELTS/TOEFL — submitted after shortlisting, not at application)",
    "Valid Passport or Travel Document",
    "Unconditional Offer from a UK University (required before interview stage)",
    "CV / Resume",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2026-11-04", "deadline_type": "Chevening Application Deadline (typically early November)"},
]


class CheveningScraper(BaseScholarshipScraper):
    name = "Chevening Scholarships"
    slug = "chevening"
    official_url = "https://www.chevening.org/scholarships/"
    DEADLINE_PAGES = ["https://www.chevening.org/scholarships/"]

    def scrape(self) -> dict:
        self.log.info("Starting Chevening scraper (deadline extraction only)...")
        combined_text = ""
        for url in self.DEADLINE_PAGES:
            resp = fetch_page(url, timeout=20)
            if resp:
                text = html_to_clean_text(resp.text)
                self.save_raw("scholarships_raw.html", resp.text)
                self.save_raw("scholarships_text.txt", text)
                combined_text += "\n\n" + text
            else:
                self.log.warning("Could not fetch %s — using curated data", url)
        return {
            "name": self.name, "country": "United Kingdom",
            "degree_level": "Master's", "funding_type": "Full Funding",
            "official_url": self.official_url,
            "deadlines": self._parse_deadlines(combined_text),
            "documents": CURATED_DOCUMENTS, "eligibility": CURATED_ELIGIBILITY,
            "raw_text": combined_text,
        }

    def _parse_deadlines(self, text: str) -> list:
        deadlines = []
        found = set()
        for pattern in [
            r"(?i)applications?\s+(?:close|deadline)[^\n]*?(\d{1,2}\s+\w+\s+\d{4})",
            r"(?i)deadline[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})",
            r"(?i)(\w+\s+\d{1,2},?\s*\d{4})[^\n]*?(?:deadline|close)",
        ]:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found:
                    found.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": "Chevening Application Deadline"})
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
