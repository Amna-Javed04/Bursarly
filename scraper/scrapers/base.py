"""
Base scraper class providing shared utilities for all scholarship scrapers.
"""
import logging
import re
import time
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def get_logger(name: str) -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  [%(name)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger(name)


def html_to_clean_text(html: str) -> str:
    """Strip boilerplate from HTML and return meaningful body text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    boilerplate_classes = [
        "gnb", "lnb", "sub-menu", "breadcrumb", "site-map",
        "footer", "btn-top", "skip-nav", "util-area", "cookie",
        "banner", "popup", "modal",
    ]
    for cls in boilerplate_classes:
        for el in soup.find_all(class_=lambda c, x=cls: c and x in c):
            el.decompose()

    content = (
        soup.find("div", id="contents")
        or soup.find("main")
        or soup.find("div", id="content")
        or soup.find("article")
        or soup.body
    )
    if not content:
        content = soup

    lines = []
    for el in content.descendants:
        if el.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            text = el.get_text(strip=True)
            if text:
                level = int(el.name[1])
                lines.append(f"\n{'#' * level} {text}")
        elif el.name == "li":
            text = el.get_text(strip=True)
            if text:
                lines.append(f"  • {text}")
        elif el.name == "p":
            text = el.get_text(strip=True)
            if text:
                lines.append(text)

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch_page(url: str, timeout: int = 30, retries: int = 3) -> Optional[requests.Response]:
    """Fetch a URL with retries. Returns None on failure."""
    log = get_logger("fetch")
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            log.warning("Attempt %d/%d failed for %s: %s", attempt, retries, url, exc)
            if attempt < retries:
                time.sleep(2 ** attempt)
    return None


class BaseScholarshipScraper:
    """Base class for all individual scholarship scrapers."""

    name: str = "BaseScholarship"
    slug: str = "base"
    official_url: str = ""

    def __init__(self):
        self.log = get_logger(self.slug)
        self.output_dir = OUTPUT_DIR / self.slug
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def scrape(self) -> dict:
        """
        Must be implemented by subclass.
        Returns a dict matching ScholarshipRaw schema:
        {
            "name": str,
            "country": str,
            "degree_level": str,
            "funding_type": str,
            "official_url": str,
            "deadlines": [{"deadline_date": "YYYY-MM-DD", "deadline_type": str}],
            "documents": [str],
            "eligibility": [str],
            "raw_text": str,   # for LLM fallback / debugging
        }
        """
        raise NotImplementedError

    def save_raw(self, filename: str, content: str) -> Path:
        """Save raw scraped content to the scraper's output subdirectory."""
        path = self.output_dir / filename
        path.write_text(content, encoding="utf-8")
        self.log.info("Saved → %s (%d bytes)", path, len(content.encode()))
        return path
