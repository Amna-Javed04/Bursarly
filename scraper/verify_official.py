"""
verify_official.py — source-of-truth verification for Bursarly listings.

Nothing in Bursarly should be invented. This tool enforces that:

1. `--verify`   Fetches each scholarship's official_url and cross-checks every
                stored deadline date against the *text of that official page*.
                A date that is not present on the official page is marked
                `is_estimated=True`, which removes it from countdowns and
                "days left" badges in the app. A dead official URL moves the
                record to `needs_fix` so it stops appearing publicly.

2. `--dedupe`   Collapses duplicate records for the same programme into a single
                canonical row, moving requirements across safely.

3. `--add`      Ingests new programmes from OFFICIAL_SOURCES, but ONLY after
                the official page answers 200. Deadlines are extracted verbatim
                from that page; anything hedged ("typically", "varies",
                "approx") is stored as estimated.

Usage:
    python verify_official.py --verify --dedupe --add
    python verify_official.py --verify --dry-run
"""

import argparse
import logging
import os
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'bursarly.db'}")

from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("verify")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 BursarlyVerifier/1.0"
)

try:
    import requests
    import certifi

    SESSION = requests.Session()
    SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en"})
    VERIFY = certifi.where()
except Exception:  # pragma: no cover - optional dependency
    requests = None
    SESSION = None
    VERIFY = True

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]
MONTH_ABBR = [m[:3] for m in MONTHS]

DEADLINE_CUES = re.compile(
    r"(deadline|closing date|applications? (?:close|closed)|apply by|"
    r"application period|application window|submission (?:deadline|period)|"
    r"last date|deadline for applications)",
    re.I,
)

HEDGE = re.compile(
    r"(typically|usually|approx|approximately|around|varies|vary|estimated|"
    r"indicative|expected|roughly|depending on|varies by|tentative)",
    re.I,
)


# ── HTTP ───────────────────────────────────────────────────────────

def fetch(url: str, timeout: int = 15) -> Tuple[int, str, str]:
    """Returns (status, final_url, text). status 0 means a transport failure."""
    if SESSION is None:
        log.warning("  requests is not installed — cannot fetch %s", url)
        return 0, url, ""
    try:
        res = SESSION.get(url, timeout=timeout, verify=VERIFY, allow_redirects=True)
        return res.status_code, res.url, res.text or ""
    except Exception as e:  # DNS, TLS, timeout
        kind = type(e).__name__
        log.warning("  fetch failed: %s (%s)", url, kind)
        return 0, url, ""


# ── Text helpers ───────────────────────────────────────────────────

def html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = unescape(text)
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def fold(text: str) -> str:
    """Case/accents folded text for tolerant matching."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def date_variants(d: date) -> List[str]:
    month = MONTHS[d.month - 1]
    abbr = MONTH_ABBR[d.month - 1]
    suffix = "th" if 11 <= d.day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(d.day % 10, "th")
    return [
        f"{d.day} {month} {d.year}",
        f"{d.day}{suffix} {month} {d.year}",
        f"{d.day} {abbr} {d.year}",
        f"{d.day}{suffix} {month}",
        f"{d.day} {month}",
        f"{d.day} {abbr}",
        f"{month} {d.day}, {d.year}",
        f"{month} {d.day}{suffix}, {d.year}",
        f"{abbr} {d.day}, {d.year}",
        f"{month} {d.day}",
        f"{month} {d.day}{suffix}",
        f"{abbr} {d.day}",
        f"{d.day}.{d.month:02d}.{d.year}",
        f"{d.day}/{d.month}/{d.year}",
        f"{d.year}-{d.month:02d}-{d.day:02d}",
    ]


def date_is_deadline_on_page(d: date, page_text: str, page_has_year: bool) -> bool:
    """
    A date is confirmed only when it appears on the official page AND a deadline
    phrase sits within a tight window around it. A date that merely appears
    somewhere on the page (results day, programme start, a news item) is not a
    confirmed application deadline.
    """
    for variant in date_variants(d):
        # Skip bare month-day matches when the page never mentions the year.
        if len(variant.split()) <= 2 and not page_has_year:
            continue
        needle = fold(variant)
        start = 0
        while True:
            idx = page_text.find(needle, start)
            if idx == -1:
                break
            start = idx + len(needle)
            window = page_text[max(0, idx - 120): idx + len(needle) + 70]
            if DEADLINE_CUES.search(window):
                return True
    return False


MONTH_RE = "|".join(MONTHS + MONTH_ABBR)

# 15 December 2026 · 15th of December 2026
DATE_DAY_FIRST = re.compile(
    r"(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(" + MONTH_RE + r")\.?,?\s+(\d{4})", re.I
)
# December 15, 2026 · Dec 15 2026
DATE_MONTH_FIRST = re.compile(
    r"(" + MONTH_RE + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})", re.I
)
# 15.12.2026 · 15/12/2026
DATE_NUMERIC = re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b")


def _month_index(raw: str) -> Optional[int]:
    raw = raw.lower().rstrip(".")
    if raw in MONTHS:
        return MONTHS.index(raw)
    for i, month in enumerate(MONTHS):
        if month.startswith(raw):
            return i
    return None


def _iter_page_dates(text: str):
    """Yields (match, parsed_date) for every date literal on the page."""
    for match in DATE_DAY_FIRST.finditer(text):
        day, month_raw, year = match.groups()
        idx = _month_index(month_raw)
        if idx is None:
            continue
        try:
            yield match, date(int(year), idx + 1, int(day))
        except ValueError:
            continue
    for match in DATE_MONTH_FIRST.finditer(text):
        month_raw, day, year = match.groups()
        idx = _month_index(month_raw)
        if idx is None:
            continue
        try:
            yield match, date(int(year), idx + 1, int(day))
        except ValueError:
            continue
    for match in DATE_NUMERIC.finditer(text):
        day, month, year = match.groups()
        try:
            yield match, date(int(year), int(month), int(day))
        except ValueError:
            continue


DATE_PATTERN = DATE_DAY_FIRST


def extract_page_deadlines(text: str) -> List[Tuple[date, str, bool]]:
    """
    Finds dates that sit inside a deadline sentence on the official page.
    Returns (date, snippet, is_estimated). Hedged language makes it estimated.
    """
    results: List[Tuple[date, str, bool]] = []
    seen = set()
    for match, parsed in _iter_page_dates(text):
        if not (date.today() - timedelta(days=30) <= parsed <= date.today() + timedelta(days=800)):
            continue

        # The cue must be close to the date: a phrase ~180 chars away belongs to
        # a different line of the timeline and produces false deadlines.
        before = text[max(0, match.start() - 110): match.start()]
        after = text[match.end(): match.end() + 60]
        if not DEADLINE_CUES.search(before) and not DEADLINE_CUES.search(after):
            continue
        window = text[max(0, match.start() - 190): min(len(text), match.end() + 120)]
        estimated = bool(HEDGE.search(before + after))
        key = (parsed, estimated)
        if key in seen:
            continue
        seen.add(key)
        results.append((parsed, window.strip(), estimated))
    return results


# ── Verification ───────────────────────────────────────────────────

STOPWORDS = {
    "scholarship", "scholarships", "program", "programme", "programs", "the", "for",
    "and", "international", "global", "government", "studies", "study", "award",
    "awards", "fund", "funding", "graduate", "undergraduate", "master", "masters",
    "degree", "degrees", "university", "with", "from", "scholars", "excellence",
}


def name_tokens(name: str) -> List[str]:
    return [
        w for w in re.findall(r"[a-z0-9]+", fold(name))
        if len(w) >= 4 and w not in STOPWORDS
    ]


DOC_STOPWORDS = {
    "copy", "copies", "letter", "letters", "form", "forms", "official", "officially",
    "certified", "certificate", "proof", "document", "documents", "required", "application",
    "statement", "with", "from", "that", "this", "your", "page", "maximum", "minimum",
}


def document_supported(document_name: str, page_folded: str) -> bool:
    """True when the distinctive words of a document name appear on the page."""
    words = [
        w for w in re.findall(r"[a-z0-9]+", fold(document_name))
        if len(w) >= 4 and w not in DOC_STOPWORDS
    ]
    if not words:
        return False
    hits = sum(1 for w in words if w in page_folded)
    return hits / len(words) >= 0.6


def verify_all(db, dry_run: bool) -> Dict[str, int]:
    stats = {"verified": 0, "blocked": 0, "unreachable": 0, "deadlines_confirmed": 0,
             "deadlines_unconfirmed": 0, "deadlines_harvested": 0,
             "requirements_verified": 0, "requirements_partial": 0, "requirements_unverified": 0}
    scholarships = db.query(models.Scholarship).order_by(models.Scholarship.name).all()

    for sch in scholarships:
        url = (sch.official_url or "").strip()
        if not url:
            sch.source_check = "unreachable"
            stats["unreachable"] += 1
            if sch.status == "approved":
                log.warning("NEEDS_FIX (no official URL): %s", sch.name)
                if not dry_run:
                    sch.status = "needs_fix"
            continue

        status, _final, html = fetch(url)
        text = html_to_text(html)
        folded = fold(text)
        page_has_year = str(date.today().year) in text or str(date.today().year + 1) in text

        if status == 200 and text:
            sch.source_check = "verified"
            stats["verified"] += 1
        elif status in (404, 410):
            # The official page is genuinely gone — this record must not be shown.
            sch.source_check = "unreachable"
            stats["unreachable"] += 1
            log.warning("NEEDS_FIX (official page %s): %s — %s", status, sch.name, url)
            if not dry_run and sch.status == "approved":
                sch.status = "needs_fix"
        elif status in (401, 403, 429, 412) or status == 0:
            # Bot protection, TLS interception or a network hiccup: the programme is
            # real, we just could not read it. Keep the record visible, but never
            # present its dates as confirmed.
            sch.source_check = "blocked"
            stats["blocked"] += 1
        else:
            sch.source_check = "blocked"
            stats["blocked"] += 1

        if not dry_run:
            sch.source_checked_at = datetime.utcnow()

        if sch.source_check == "verified":
            for deadline in sch.deadlines:
                confirmed = date_is_deadline_on_page(deadline.deadline_date, folded, page_has_year)
                if confirmed:
                    if not dry_run:
                        deadline.is_estimated = False
                        sch.last_verified_at = datetime.utcnow()
                    stats["deadlines_confirmed"] += 1
                else:
                    if not dry_run:
                        deadline.is_estimated = True
                    stats["deadlines_unconfirmed"] += 1

            # Check whether the stored document list is actually on the page.
            if sch.documents:
                found = sum(1 for doc in sch.documents if document_supported(doc.document_name, folded))
                ratio = found / len(sch.documents)
                if ratio >= 0.6:
                    sch.requirements_check = "verified"
                    stats["requirements_verified"] += 1
                elif ratio > 0:
                    sch.requirements_check = "partial"
                    stats["requirements_partial"] += 1
                else:
                    sch.requirements_check = "unverified"
                    stats["requirements_unverified"] += 1
            else:
                sch.requirements_check = "not_checked"

            # Replace unsupported dates with dates the page actually prints.
            harvested = extract_page_deadlines(text)
            existing_dates = {d.deadline_date for d in sch.deadlines}
            tokens = name_tokens(sch.name)
            for when, snippet, hedged in harvested[:4]:
                if when in existing_dates:
                    continue
                # Only trust a date as confirmed when the surrounding text
                # also names this programme.
                mentions_programme = any(tok in fold(snippet) for tok in tokens)
                estimated = hedged or not mentions_programme
                if dry_run:
                    stats["deadlines_harvested"] += 1
                    continue
                db.add(
                    models.ScholarshipDeadline(
                        scholarship_id=sch.id,
                        deadline_date=when,
                        cycle_year=when.year,
                        deadline_type=re.sub(r"\s+", " ", snippet)[:100],
                        is_estimated=estimated,
                    )
                )
                existing_dates.add(when)
                stats["deadlines_harvested"] += 1
                log.info(
                    "      + %s %s",
                    when.isoformat(),
                    "(official page)" if not estimated else "(unconfirmed wording)",
                )
        else:
            # Cannot read the official page → no date may be presented as confirmed.
            for deadline in sch.deadlines:
                if not dry_run:
                    deadline.is_estimated = True
                stats["deadlines_unconfirmed"] += 1

        log.info(
            "%-58s %-12s %s",
            sch.name[:58],
            sch.source_check,
            f"{len(sch.deadlines)} deadline(s)",
        )

    if not dry_run:
        db.commit()
    return stats


# ── Deduplication ──────────────────────────────────────────────────

MERGE_GROUPS: List[List[str]] = [
    [
        "Global Korea Scholarship (GKS)",
        "Global Korea Scholarship — Graduate",
        "Global Korea Scholarship — Undergraduate",
    ],
    ["DAAD EPOS Scholarship", "DAAD Scholarships for Development (EPOS)"],
    [
        "Erasmus Mundus Joint Master Degrees",
        "Erasmus Mundus Joint Master Degrees (EMJMD)",
    ],
    ["Chinese Government Scholarship", "Chinese Government Scholarship (CSC)"],
    [
        "Türkiye Bursları (Turkey Scholarships)",
        "Türkiye Scholarships — Undergraduate",
        "Türkiye Scholarships — Graduate",
        "Türkiye Scholarships — Research",
        "Türkiye Scholarships — Short-Term Programs",
    ],
]


def _child_score(sch) -> tuple:
    children = len(sch.deadlines) + len(sch.documents) + len(sch.eligibility)
    return (children, 1 if sch.source_type == "scraper" else 0)


def dedupe(db, dry_run: bool) -> int:
    removed = 0
    for group in MERGE_GROUPS:
        members = (
            db.query(models.Scholarship)
            .filter(models.Scholarship.name.in_(group))
            .all()
        )
        if len(members) < 2:
            continue
        keeper = max(members, key=_child_score)
        log.info("MERGE → keep %r", keeper.name)

        for dup in members:
            if dup.id == keeper.id:
                continue
            log.info("      fold %r", dup.name)

            existing_docs = {fold(d.document_name) for d in keeper.documents}
            for doc in list(dup.documents):
                if fold(doc.document_name) in existing_docs:
                    continue
                keeper.documents.append(
                    models.ScholarshipDocument(
                        document_name=doc.document_name, is_required=doc.is_required
                    )
                )
                existing_docs.add(fold(doc.document_name))

            existing_elig = {fold(e.criteria_text) for e in keeper.eligibility}
            for elig in list(dup.eligibility):
                if fold(elig.criteria_text) in existing_elig:
                    continue
                keeper.eligibility.append(
                    models.ScholarshipEligibility(criteria_text=elig.criteria_text)
                )
                existing_elig.add(fold(elig.criteria_text))

            existing_dates = {(d.deadline_date, d.deadline_type) for d in keeper.deadlines}
            for deadline in list(dup.deadlines):
                if (deadline.deadline_date, deadline.deadline_type) in existing_dates:
                    continue
                keeper.deadlines.append(
                    models.ScholarshipDeadline(
                        deadline_date=deadline.deadline_date,
                        cycle_year=deadline.cycle_year,
                        deadline_type=deadline.deadline_type,
                        is_estimated=deadline.is_estimated,
                    )
                )
                existing_dates.add((deadline.deadline_date, deadline.deadline_type))

            # Preserve user trackers pointing at the duplicate.
            for tracker in list(dup.user_scholarships):
                clash = (
                    db.query(models.UserScholarship)
                    .filter(
                        models.UserScholarship.user_id == tracker.user_id,
                        models.UserScholarship.scholarship_id == keeper.id,
                    )
                    .first()
                )
                if clash:
                    db.delete(tracker)
                else:
                    tracker.scholarship_id = keeper.id

            if not dup.official_url and keeper.official_url:
                pass
            if dup.official_url and not keeper.official_url:
                keeper.official_url = dup.official_url

            db.delete(dup)
            removed += 1

    if not dry_run:
        db.commit()
    return removed


# ── New official sources ───────────────────────────────────────────

OFFICIAL_SOURCES: List[Dict[str, str]] = [
    {
        "name": "VLIR-UOS Scholarships",
        "country": "Belgium",
        "degree_level": "Master's",
        "funding_type": "fully_funded",
        "official_url": "https://www.vliruos.be/en/scholarships",
    },
    {
        "name": "New Zealand Scholarships",
        "country": "New Zealand",
        "degree_level": "Undergraduate / Postgraduate",
        "funding_type": "fully_funded",
        "official_url": "https://www.nzscholarships.govt.nz/",
    },
    {
        "name": "Joint Japan/World Bank Graduate Scholarship Program",
        "country": "Japan",
        "degree_level": "Master's",
        "funding_type": "fully_funded",
        "official_url": "https://www.worldbank.org/en/programs/scholarships",
    },
    {
        "name": "Invest Your Talent in Italy",
        "country": "Italy",
        "degree_level": "Master's",
        "funding_type": "partially_funded",
        "official_url": "https://investyourtalent.esteri.it/",
    },
    {
        "name": "Mastercard Foundation Scholars Program",
        "country": "Multiple",
        "degree_level": "Undergraduate / Master's",
        "funding_type": "fully_funded",
        "official_url": "https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/",
    },
    {
        "name": "Stipendium Hungaricum",
        "country": "Hungary",
        "degree_level": "Undergraduate / Master's / PhD",
        "funding_type": "fully_funded",
        "official_url": "https://stipendiumhungaricum.hu/",
    },
    {
        "name": "Finland Scholarships",
        "country": "Finland",
        "degree_level": "Master's",
        "funding_type": "partially_funded",
        "official_url": "https://www.studyinfinland.fi/funding-your-studies",
    },
    {
        "name": "Czech Government Scholarships",
        "country": "Czech Republic",
        "degree_level": "Master's / PhD",
        "funding_type": "fully_funded",
        "official_url": "https://www.dzs.cz/en",
    },
    {
        "name": "NAWA Poland Scholarships",
        "country": "Poland",
        "degree_level": "Master's / PhD",
        "funding_type": "partially_funded",
        "official_url": "https://nawa.gov.pl/en/",
    },
]


def add_sources(db, dry_run: bool) -> int:
    added = 0
    for source in OFFICIAL_SOURCES:
        exists = (
            db.query(models.Scholarship)
            .filter(models.Scholarship.official_url == source["official_url"])
            .first()
        )
        if exists:
            log.info("SKIP (already present): %s", source["name"])
            continue

        status, _final, html = fetch(source["official_url"])
        if status != 200 or not html.strip():
            log.warning("SKIP (official page %s): %s", status or "no response", source["name"])
            continue

        text = html_to_text(html)
        extracted = extract_page_deadlines(text)
        log.info(
            "ADD  %-52s page OK · %d date(s) in deadline context",
            source["name"][:52],
            len(extracted),
        )

        if dry_run:
            added += 1
            continue

        sch = models.Scholarship(
            name=source["name"],
            country=source["country"],
            degree_level=source["degree_level"],
            funding_type=source["funding_type"],
            official_url=source["official_url"],
            status="approved",
            source_type="official_verified",
            source_check="verified",
            source_checked_at=datetime.utcnow(),
            last_verified_at=datetime.utcnow(),
        )
        db.add(sch)
        db.flush()

        for when, snippet, estimated in extracted[:3]:
            db.add(
                models.ScholarshipDeadline(
                    scholarship_id=sch.id,
                    deadline_date=when,
                    cycle_year=when.year,
                    deadline_type=re.sub(r"\s+", " ", snippet)[:100],
                    is_estimated=estimated,
                )
            )
        added += 1

    if not dry_run:
        db.commit()
    return added


# ── Main ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Verify Bursarly scholarship data against official sources.")
    parser.add_argument("--verify", action="store_true", help="check official pages and re-grade deadlines")
    parser.add_argument("--dedupe", action="store_true", help="merge duplicate programme records")
    parser.add_argument("--add", action="store_true", help="ingest new programmes from verified official pages")
    parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    parser.add_argument("--all", action="store_true", help="verify + dedupe + add")
    args = parser.parse_args()

    if not any([args.verify, args.dedupe, args.add, args.all]):
        args.all = True

    db = SessionLocal()
    try:
        if args.dedupe or args.all:
            removed = dedupe(db, args.dry_run)
            print(f"\nDuplicates merged: {removed}\n")

        if args.add or args.all:
            added = add_sources(db, args.dry_run)
            print(f"\nNew official programmes added: {added}\n")

        if args.verify or args.all:
            stats = verify_all(db, args.dry_run)
            print("\nVerification summary")
            for key, value in stats.items():
                print(f"  {key:24} {value}")
            print(f"  {'dry_run':24} {args.dry_run}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
