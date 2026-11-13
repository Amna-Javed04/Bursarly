"""
Bursarly Aggregate Scholarship Scraper
=======================================
Runs all individual scholarship scrapers, validates their output,
and upserts the results into the Bursarly database.

Usage:
    python aggregate_scraper.py                    # run all scrapers
    python aggregate_scraper.py --scraper gks      # run a specific scraper
    python aggregate_scraper.py --dry-run          # scrape but don't write to DB
    python aggregate_scraper.py --list             # list all available scrapers

Available scrapers:
    gks, daad, turkiye_burslari, erasmus_mundus, mext, chinese_govt, chevening

Strategy:
    1. Each scraper fetches from the official website (requests + BeautifulSoup)
    2. It extracts structured data (deadlines, docs, eligibility) via regex + keyword matching
    3. This runner validates the output against business rules
    4. Valid data is upserted into the DB (matched by name + country, never duplicated)
    5. Invalid data is saved as 'needs_fix' for admin review

Dependencies:
    pip install requests beautifulsoup4 dateparser
"""

import argparse
import json
import logging
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

# ── Path setup ────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Point to the real backend database
os.environ.setdefault("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'bursarly.db'}")

from app.database import SessionLocal
from app import models

# ── Registry of all scrapers ──────────────────────────────────
from scrapers.gks import GKSScraper
from scrapers.daad import DAADScraper
from scrapers.turkiye_burslari import TurkiyeBurslarScraper
from scrapers.erasmus_mundus import ErasmusMundusScraper
from scrapers.mext import MEXTScraper
from scrapers.chinese_govt import ChineseGovtScraper
from scrapers.chevening import CheveningScraper

SCRAPER_REGISTRY = {
    "gks": GKSScraper,
    "daad": DAADScraper,
    "turkiye_burslari": TurkiyeBurslarScraper,
    "erasmus_mundus": ErasmusMundusScraper,
    "mext": MEXTScraper,
    "chinese_govt": ChineseGovtScraper,
    "chevening": CheveningScraper,
}

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aggregate-scraper")


# ── Validation ────────────────────────────────────────────────
def validate(data: dict) -> tuple[bool, str]:
    """Validate scraped scholarship data against business rules."""
    required = ["name", "country", "degree_level", "funding_type", "deadlines"]
    for field in required:
        if not data.get(field):
            return False, f"Missing required field: {field}"

    if data["funding_type"] not in ("Full Funding", "Partial Funding", "Unknown"):
        return False, f"Invalid funding_type: {data['funding_type']}"

    today = date.today()
    max_future = today + timedelta(days=365 * 3)

    if not data["deadlines"]:
        return False, "No deadlines found."

    for dl in data["deadlines"]:
        if not dl.get("deadline_date"):
            return False, f"Null deadline_date for type: {dl.get('deadline_type')}"
        try:
            d = date.fromisoformat(dl["deadline_date"])
        except ValueError:
            return False, f"Invalid date format: {dl['deadline_date']}"
        if d < today:
            return False, f"Deadline is in the past: {d}"
        if d > max_future:
            return False, f"Deadline implausibly far in future: {d}"

    return True, ""


# ── Database upsert ───────────────────────────────────────────
def upsert_scholarship(data: dict, is_valid: bool, validation_msg: str, dry_run: bool = False) -> str:
    """
    Upsert scholarship into DB.
    Matches by (name, country) to avoid duplicates.
    Returns the resulting status string.
    """
    status = "approved" if is_valid else "needs_fix"
    log.info(
        "  [%s] %s → %s",
        "DRY-RUN" if dry_run else "DB",
        data["name"],
        status if is_valid else f"{status} ({validation_msg})",
    )

    if dry_run:
        return status

    db = SessionLocal()
    try:
        # Check for existing record
        existing = (
            db.query(models.Scholarship)
            .filter_by(name=data["name"], country=data["country"])
            .first()
        )

        if existing:
            log.info("  Updating existing scholarship (id=%s)", existing.id)
            existing.degree_level = data["degree_level"]
            existing.funding_type = data["funding_type"]
            existing.official_url = data["official_url"]
            existing.status = status
            existing.source_type = "scraper"
            existing.last_verified_at = datetime.utcnow()
            scholarship = existing

            # Clear old sub-records so we replace with fresh scraped data
            db.query(models.ScholarshipDeadline).filter_by(scholarship_id=existing.id).delete()
            db.query(models.ScholarshipDocument).filter_by(scholarship_id=existing.id).delete()
            db.query(models.ScholarshipEligibility).filter_by(scholarship_id=existing.id).delete()
        else:
            log.info("  Inserting new scholarship: %s", data["name"])
            import uuid
            scholarship = models.Scholarship(
                id=uuid.uuid4(),
                name=data["name"],
                country=data["country"],
                degree_level=data["degree_level"],
                funding_type=data["funding_type"],
                official_url=data["official_url"],
                status=status,
                source_type="scraper",
                last_verified_at=datetime.utcnow(),
            )
            db.add(scholarship)
            db.flush()

        # Insert deadlines
        for dl in data["deadlines"]:
            try:
                dl_date = date.fromisoformat(dl["deadline_date"])
            except (ValueError, TypeError):
                continue
            db.add(models.ScholarshipDeadline(
                scholarship_id=scholarship.id,
                deadline_date=dl_date,
                cycle_year=dl_date.year,
                deadline_type=dl["deadline_type"],
            ))

        # Insert documents
        for doc in data.get("documents", []):
            if doc and doc.strip():
                db.add(models.ScholarshipDocument(
                    scholarship_id=scholarship.id,
                    document_name=doc[:255],
                    is_required=True,
                ))

        # Insert eligibility
        for elig in data.get("eligibility", []):
            if elig and elig.strip():
                db.add(models.ScholarshipEligibility(
                    scholarship_id=scholarship.id,
                    criteria_text=elig[:2000],
                ))

        db.commit()
        log.info("  ✓ Committed to DB: %s", data["name"])
        return status

    except Exception as exc:
        db.rollback()
        log.error("  ✗ DB error for %s: %s", data["name"], exc)
        return "error"
    finally:
        db.close()


# ── Result reporting ──────────────────────────────────────────
def print_report(results: list[dict]) -> None:
    log.info("\n" + "=" * 60)
    log.info("AGGREGATE SCRAPE REPORT")
    log.info("=" * 60)
    for r in results:
        icon = "✓" if r["status"] == "approved" else ("⚠" if r["status"] == "needs_fix" else "✗")
        log.info("  %s %-45s [%s]", icon, r["name"], r["status"])
        if r.get("error"):
            log.info("      Reason: %s", r["error"])
    log.info("=" * 60)
    approved = sum(1 for r in results if r["status"] == "approved")
    log.info("  Total: %d | Approved: %d | Needs Fix: %d | Errors: %d",
             len(results), approved,
             sum(1 for r in results if r["status"] == "needs_fix"),
             sum(1 for r in results if r["status"] == "error"))
    log.info("=" * 60 + "\n")


# ── CLI ───────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bursarly Aggregate Scholarship Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--scraper", "-s",
        choices=list(SCRAPER_REGISTRY.keys()),
        help="Run only this specific scraper (default: run all)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Scrape and validate but do NOT write to the database",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all available scrapers and exit",
    )
    parser.add_argument(
        "--output-json",
        help="Optional path to write scraped results as JSON (e.g. output/results.json)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.list:
        print("\nAvailable scrapers:")
        for key, cls in SCRAPER_REGISTRY.items():
            print(f"  {key:25s}  →  {cls.name}  ({cls.official_url})")
        print()
        return

    # Determine which scrapers to run
    if args.scraper:
        scrapers_to_run = {args.scraper: SCRAPER_REGISTRY[args.scraper]}
    else:
        scrapers_to_run = SCRAPER_REGISTRY

    log.info("=" * 60)
    log.info("Bursarly Aggregate Scraper — %s UTC", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    log.info("Mode: %s | Scrapers: %s", "DRY-RUN" if args.dry_run else "LIVE", ", ".join(scrapers_to_run.keys()))
    log.info("=" * 60)

    results = []
    all_data = []

    for key, ScraperClass in scrapers_to_run.items():
        log.info("\n── Running scraper: %s ──────────────────────────────", key)
        scraper = ScraperClass()
        result_entry = {"name": scraper.name, "slug": key, "status": "error", "error": None}

        try:
            data = scraper.scrape()
            all_data.append(data)

            log.info("  Scraped: %s", data["name"])
            log.info("  Deadlines found: %d", len(data.get("deadlines", [])))
            log.info("  Documents found: %d", len(data.get("documents", [])))
            log.info("  Eligibility items: %d", len(data.get("eligibility", [])))

            is_valid, validation_msg = validate(data)
            if not is_valid:
                log.warning("  Validation FAILED: %s", validation_msg)
                result_entry["error"] = validation_msg
            else:
                log.info("  Validation PASSED")

            status = upsert_scholarship(data, is_valid, validation_msg, dry_run=args.dry_run)
            result_entry["status"] = status

        except Exception as exc:
            log.error("  Scraper %s raised an exception: %s", key, exc, exc_info=True)
            result_entry["error"] = str(exc)

        results.append(result_entry)

    # Optional JSON dump
    if args.output_json:
        out_path = Path(args.output_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(all_data, indent=2, default=str), encoding="utf-8")
        log.info("Results JSON → %s", out_path.resolve())

    print_report(results)


if __name__ == "__main__":
    main()
