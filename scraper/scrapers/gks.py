"""
GKS (Global Korea Scholarship) Scraper
Official URL: https://www.studyinkorea.go.kr/en/sub/gks/allntn/scholarshipDtl.do

Strategy:
  - Live scraping is ONLY used to extract updated deadlines (they change annually).
  - Eligibility, documents, and other stable fields use VERIFIED curated data.
  - This prevents garbage from page boilerplate polluting critical fields.
"""
import re
from datetime import date
from typing import Optional
from .base import BaseScholarshipScraper, fetch_page, html_to_clean_text

# ── Verified curated data (stable, rarely changes) ────────────
CURATED_ELIGIBILITY = [
    "Applicant and both parents must be citizens of a country other than South Korea.",
    "Must be under 25 years old for Undergraduate programs; under 40 years old for Graduate programs.",
    "Cumulative GPA must be 80% or higher (or ranked in top 20% of class) from the previously attended institution.",
    "Must be in good health — both physical and mental.",
    "Must have completed (or be expected to complete) the required prior degree before the start date.",
    "Must be a citizen of a country invited by NIIED to participate in the GKS program.",
]

CURATED_DOCUMENTS = [
    "GKS Application Form",
    "Personal Statement",
    "Study Plan",
    "Official Academic Transcripts",
    "Graduation / Degree Certificate",
    "Recommendation Letters (2)",
    "Proof of Citizenship (Passport or birth certificate of applicant and parents)",
    "Medical Assessment Form",
    "TOPIK Korean Language Certificate (optional but preferred)",
]

CURATED_DEADLINES_FALLBACK = [
    {"deadline_date": "2026-10-20", "deadline_type": "Undergraduate Embassy Track Application"},
    {"deadline_date": "2027-02-15", "deadline_type": "Graduate Track Application"},
]


class GKSScraper(BaseScholarshipScraper):
    name = "Global Korea Scholarship (GKS)"
    slug = "gks"
    official_url = "https://www.studyinkorea.go.kr/en/sub/gks/allntn/scholarshipDtl.do"

    # Only fetch pages known to contain deadline/notice info
    DEADLINE_PAGES = [
        "https://www.studyinkorea.go.kr/en/sub/gks/allntn/scholarshipDtl.do",
        "https://www.studyinkorea.go.kr/en/sub/gks/allntn/scholarshipNoticeList.do",
    ]

    def scrape(self) -> dict:
        self.log.info("Starting GKS scraper (deadline extraction only)...")
        combined_text = ""

        for url in self.DEADLINE_PAGES:
            self.log.info("Fetching: %s", url)
            resp = fetch_page(url)
            if not resp:
                self.log.warning("Could not fetch %s — skipping", url)
                continue
            text = html_to_clean_text(resp.text)
            self.save_raw(f"{url.split('/')[-1]}_raw.html", resp.text)
            self.save_raw(f"{url.split('/')[-1]}_text.txt", text)
            combined_text += "\n\n" + text

        deadlines = self._parse_deadlines(combined_text)
        self.log.info("Using verified curated eligibility and documents.")

        return {
            "name": self.name,
            "country": "South Korea",
            "degree_level": "Undergraduate & Graduate",
            "funding_type": "Full Funding",
            "official_url": self.official_url,
            "deadlines": deadlines,
            "documents": CURATED_DOCUMENTS,
            "eligibility": CURATED_ELIGIBILITY,
            "raw_text": combined_text,
        }

    def _parse_deadlines(self, text: str) -> list:
        """
        Try to extract deadline dates from live page text.
        Falls back to known cycle dates if parsing yields nothing valid.
        """
        deadlines = []
        # Patterns targeting deadline-specific contexts
        patterns = [
            (r"(?i)(?:embassy\s+track)[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})", "Undergraduate Embassy Track Application"),
            (r"(?i)(?:graduate)[^\n]*?deadline[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})", "Graduate Track Application"),
            (r"(?i)deadline[^\n]*?(\d{4}[-./]\d{1,2}[-./]\d{1,2})", "Application Deadline"),
            (r"(?i)(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^\n]*?deadline", "Application Deadline"),
        ]
        found_dates = set()
        for pattern, dtype in patterns:
            for m in re.finditer(pattern, text):
                parsed = _try_parse_date(m.group(1).strip())
                if parsed and parsed > date.today() and parsed not in found_dates:
                    found_dates.add(parsed)
                    deadlines.append({"deadline_date": str(parsed), "deadline_type": dtype})

        if not deadlines:
            self.log.warning("No live deadlines parsed — using verified cycle estimates")
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
