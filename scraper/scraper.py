"""
GKS (Global Korea Scholarship) Scraper
=======================================
Scrapes the official Study in Korea scholarship page and saves raw content
to the output/ directory for inspection before the extraction layer is built.

Strategy
--------
  Phase 1 — requests + BeautifulSoup
    The server renders most of the GKS content (scholarship info, eligibility,
    selection process, university lists) into plain HTML. This is fast and
    reliable for that section.

  Phase 2 — Playwright (async)
    The tab-based interface (Degree Programs, Exchange, Korea-Japan) and the
    GKS Notice board require JavaScript to fully render. Playwright handles
    these by clicking each tab and waiting for content to stabilise.

  Fallback
    If Playwright is not installed (playwright package missing or browsers not
    installed) the scraper logs a warning and saves whatever was captured in
    Phase 1 only.

Output files written to output/
  gks_main_raw.html         — raw HTML of the scholarship page (requests)
  gks_main_text.txt         — cleaned visible text from the main page
  gks_tab_degree.html       — Playwright-rendered Degree Programs tab HTML
  gks_tab_exchange.html     — Playwright-rendered Exchange Students tab HTML
  gks_tab_korea_japan.html  — Playwright-rendered Korea-Japan Program tab HTML
  gks_notice_board.html     — Playwright-rendered GKS Notice board page
  gks_notice_board.txt      — cleaned text of the notice board
  scrape_manifest.json      — metadata: URLs scraped, timestamps, file sizes,
                              HTTP status, method used

Usage
-----
  python scraper.py               # runs both phases
  python scraper.py --phase1      # requests only (fast, no browser needed)
  python scraper.py --phase2      # Playwright only
  python scraper.py --headful     # run Playwright with visible browser window

Dependencies
------------
  pip install requests beautifulsoup4 playwright
  playwright install chromium
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Constants ─────────────────────────────────────────────────

BASE_URL = "https://www.studyinkorea.go.kr"

# The GKS scholarship page — uses Korean path (/ko/) which returns English
# content when the Accept-Language header or query includes 'en'
GKS_PAGE_URL = "https://www.studyinkorea.go.kr/ko/plan/scholarship.do"

# GKS notice board — lists official PDFs and announcements
GKS_NOTICE_URL = "https://www.studyinkorea.go.kr/ko/notice/scholarshipsList.do?boardSort=3"

# Individual tabs activated by clicking their anchor IDs
TABS = {
    "degree":      "#gks-tab1",   # Degree Programs (undergrad + graduate)
    "korea_japan": "#gks-tab2",   # Korea-Japan Joint Program
    "exchange":    "#gks-tab3",   # Exchange Students Program
    "notice":      "#gks-tab4",   # GKS Notice links (internal)
}

OUTPUT_DIR = Path(__file__).parent / "output"
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

# ── Logging ───────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("gks-scraper")

# ── Manifest ──────────────────────────────────────────────────

manifest: dict = {
    "scrape_start_utc": datetime.now(timezone.utc).isoformat(),
    "pages": [],
}


def record(url: str, output_file: Path, method: str, status: int | str, notes: str = "") -> None:
    manifest["pages"].append({
        "url": url,
        "file": output_file.name,
        "method": method,
        "http_status": status,
        "file_size_bytes": output_file.stat().st_size if output_file.exists() else 0,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
    })


def save_manifest() -> None:
    manifest["scrape_end_utc"] = datetime.now(timezone.utc).isoformat()
    out = OUTPUT_DIR / "scrape_manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("Manifest saved → %s", out)


# ── Text cleaning ─────────────────────────────────────────────

def html_to_clean_text(html: str) -> str:
    """
    Strips boilerplate nav/header/footer from the HTML and returns the
    meaningful body text, preserving headings and list structure.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Remove navigation, scripts, styles, footers
    for tag in soup.find_all(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()

    # Remove elements by class patterns (site-specific boilerplate)
    boilerplate_classes = [
        "gnb", "lnb", "sub-menu", "breadcrumb", "site-map",
        "footer", "btn-top", "skip-nav", "util-area",
    ]
    for cls in boilerplate_classes:
        for el in soup.find_all(class_=lambda c, x=cls: c and x in c):
            el.decompose()

    # Target the main content region if present
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

    # Collapse runs of blank lines
    text = "\n".join(lines)
    import re
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Phase 1: requests + BeautifulSoup ────────────────────────

def phase1_requests() -> None:
    log.info("=== Phase 1: requests + BeautifulSoup ===")

    # ── Main GKS page ──
    log.info("Fetching: %s", GKS_PAGE_URL)
    t0 = time.time()
    try:
        resp = requests.get(GKS_PAGE_URL, headers=HEADERS, timeout=30)
        elapsed = time.time() - t0
        resp.raise_for_status()
    except requests.RequestException as exc:
        log.error("Failed to fetch main page: %s", exc)
        return

    log.info(
        "Response: HTTP %d | %.2fs | content-type: %s | size: %d bytes",
        resp.status_code,
        elapsed,
        resp.headers.get("Content-Type", "?"),
        len(resp.content),
    )

    # Save raw HTML
    raw_html_path = OUTPUT_DIR / "gks_main_raw.html"
    raw_html_path.write_bytes(resp.content)
    log.info("Saved raw HTML → %s", raw_html_path)
    record(GKS_PAGE_URL, raw_html_path, "requests", resp.status_code)

    # Save cleaned text
    clean_text = html_to_clean_text(resp.text)
    text_path = OUTPUT_DIR / "gks_main_text.txt"
    text_path.write_text(clean_text, encoding="utf-8")
    log.info("Saved cleaned text → %s (%d chars)", text_path, len(clean_text))
    record(GKS_PAGE_URL, text_path, "requests+bs4", resp.status_code, notes="cleaned text")

    # Print a preview so you can verify content was pulled
    preview_lines = [l for l in clean_text.splitlines() if l.strip()][:40]
    log.info("--- Content preview (first 40 non-empty lines) ---")
    for line in preview_lines:
        print(f"  {line}")
    print()

    # ── Quick check: find all anchor hrefs that look like PDF notices ──
    soup = BeautifulSoup(resp.text, "html.parser")
    pdf_links = [
        (a.get_text(strip=True), a["href"] if a["href"].startswith("http") else BASE_URL + a["href"])
        for a in soup.find_all("a", href=True)
        if a["href"].endswith(".pdf")
    ]
    if pdf_links:
        log.info("Found %d PDF link(s) on the main page:", len(pdf_links))
        for title, href in pdf_links[:10]:
            log.info("  [PDF] %s → %s", title or "(no title)", href)
    else:
        log.info("No PDF links found in Phase 1 (tab content likely JS-rendered)")

    log.info("Phase 1 complete.")


# ── Phase 2: Playwright ───────────────────────────────────────

async def phase2_playwright(headful: bool = False) -> None:
    log.info("=== Phase 2: Playwright (async Chromium) ===")

    try:
        from playwright.async_api import async_playwright, TimeoutError as PWTimeout
    except ImportError:
        log.warning(
            "playwright package not found. "
            "Install it with: pip install playwright && playwright install chromium"
        )
        return

    async with async_playwright() as pw:
        log.info("Launching Chromium browser (%s)…", "headful" if headful else "headless")
        browser = await pw.chromium.launch(headless=not headful)
        ctx = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )

        # ── Scrape each GKS tab ──────────────────────────────────────

        page = await ctx.new_page()
        log.info("Navigating to GKS page: %s", GKS_PAGE_URL)

        try:
            await page.goto(GKS_PAGE_URL, wait_until="networkidle", timeout=60_000)
        except PWTimeout:
            log.warning("networkidle timed out — proceeding with domcontentloaded snapshot")
            await page.goto(GKS_PAGE_URL, wait_until="domcontentloaded", timeout=30_000)

        log.info("Page title: %s", await page.title())

        # Snapshot the fully-rendered full page (all tabs) as baseline
        full_html = await page.content()
        full_path = OUTPUT_DIR / "gks_full_rendered.html"
        full_path.write_text(full_html, encoding="utf-8")
        log.info("Saved full rendered HTML → %s (%d bytes)", full_path, len(full_html.encode()))
        record(GKS_PAGE_URL, full_path, "playwright", "rendered", notes="full page before tab clicks")

        # Click each tab and save the resulting HTML
        for tab_name, anchor in TABS.items():
            log.info("Clicking tab: %s (%s)", tab_name, anchor)
            try:
                # The tabs use anchor links — locate by href attribute
                tab_btn = page.locator(f'a[href*="{anchor.lstrip("#")}"]').first
                if await tab_btn.count() == 0:
                    # Try data-target or aria patterns
                    tab_btn = page.locator(f'[href="{anchor}"]').first
                if await tab_btn.count() == 0:
                    log.warning("  Tab button not found for %s — skipping", anchor)
                    continue

                await tab_btn.click()
                # Wait for any network activity or animation to settle
                await page.wait_for_load_state("networkidle", timeout=10_000)
                await page.wait_for_timeout(800)  # visual settle

            except PWTimeout:
                log.warning("  Timeout waiting for tab %s — saving current state", tab_name)
            except Exception as exc:
                log.warning("  Could not click tab %s: %s", tab_name, exc)

            # Save HTML snapshot after clicking the tab
            tab_html = await page.content()
            tab_file = OUTPUT_DIR / f"gks_tab_{tab_name}.html"
            tab_file.write_text(tab_html, encoding="utf-8")
            log.info("  Saved tab HTML → %s (%d bytes)", tab_file, len(tab_html.encode()))

            # Also save cleaned text for this tab's visible area
            tab_text = html_to_clean_text(tab_html)
            tab_text_file = OUTPUT_DIR / f"gks_tab_{tab_name}.txt"
            tab_text_file.write_text(tab_text, encoding="utf-8")

            record(GKS_PAGE_URL + anchor, tab_file, "playwright", "rendered", notes=f"tab: {tab_name}")

        await page.close()

        # ── GKS Notice board ─────────────────────────────────────────

        log.info("Navigating to GKS Notice board: %s", GKS_NOTICE_URL)
        notice_page = await ctx.new_page()
        try:
            await notice_page.goto(GKS_NOTICE_URL, wait_until="networkidle", timeout=60_000)
        except PWTimeout:
            log.warning("networkidle timeout on notice board — saving domcontentloaded state")
            await notice_page.goto(GKS_NOTICE_URL, wait_until="domcontentloaded", timeout=30_000)
            await notice_page.wait_for_timeout(3000)

        notice_html = await notice_page.content()
        notice_html_path = OUTPUT_DIR / "gks_notice_board.html"
        notice_html_path.write_text(notice_html, encoding="utf-8")
        log.info("Saved notice board HTML → %s (%d bytes)", notice_html_path, len(notice_html.encode()))
        record(GKS_NOTICE_URL, notice_html_path, "playwright", "rendered")

        notice_text = html_to_clean_text(notice_html)
        notice_text_path = OUTPUT_DIR / "gks_notice_board.txt"
        notice_text_path.write_text(notice_text, encoding="utf-8")
        log.info("Saved notice board text → %s", notice_text_path)
        record(GKS_NOTICE_URL, notice_text_path, "playwright", "rendered", notes="cleaned text")

        # Extract notice list items for a quick preview
        soup = BeautifulSoup(notice_html, "html.parser")
        notice_items = []
        for row in soup.select("table tbody tr, ul.board-list li, .notice-list li"):
            title_el = row.select_one("td:nth-child(2) a, .subject a, .title a, a")
            date_el = row.select_one("td:last-child, .date, .reg-date")
            if title_el:
                notice_items.append({
                    "title": title_el.get_text(strip=True),
                    "href": title_el.get("href", ""),
                    "date": date_el.get_text(strip=True) if date_el else "",
                })

        if notice_items:
            log.info("Found %d notice items on notice board:", len(notice_items))
            for item in notice_items[:10]:
                log.info("  [%s] %s", item["date"], item["title"][:80])
        else:
            log.info("Notice board: no items parsed by CSS selectors (see gks_notice_board.html)")

        # Extract PDF links from notice board
        pdf_links = [
            (a.get_text(strip=True), BASE_URL + a["href"] if a["href"].startswith("/") else a["href"])
            for a in soup.find_all("a", href=True)
            if ".pdf" in a["href"].lower()
        ]
        if pdf_links:
            log.info("Found %d PDF link(s) on notice board:", len(pdf_links))
            for title, href in pdf_links[:15]:
                log.info("  [PDF] %s → %s", title or "(no title)", href)

        await notice_page.close()
        await browser.close()

    log.info("Phase 2 complete.")


# ── Summary reporter ──────────────────────────────────────────

def print_summary() -> None:
    log.info("=== Scrape Summary ===")
    total_bytes = sum(p.get("file_size_bytes", 0) for p in manifest["pages"])
    log.info("Files written to: %s", OUTPUT_DIR.resolve())
    log.info("Total files: %d | Total bytes: %s", len(manifest["pages"]), f"{total_bytes:,}")
    log.info("")
    for p in manifest["pages"]:
        log.info(
            "  %-40s  %-12s  HTTP %-10s  %s bytes",
            p["file"],
            p["method"],
            str(p["http_status"]),
            f"{p['file_size_bytes']:,}",
        )


# ── Entry point ───────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape GKS (Global Korea Scholarship) official information page"
    )
    parser.add_argument(
        "--phase1", action="store_true",
        help="Run only Phase 1 (requests + BeautifulSoup, no browser required)"
    )
    parser.add_argument(
        "--phase2", action="store_true",
        help="Run only Phase 2 (Playwright browser automation)"
    )
    parser.add_argument(
        "--headful", action="store_true",
        help="Run Playwright with a visible browser window"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_phase1 = args.phase1 or (not args.phase1 and not args.phase2)
    run_phase2 = args.phase2 or (not args.phase1 and not args.phase2)

    log.info("GKS Scraper starting — %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log.info("Output directory: %s", OUTPUT_DIR.resolve())

    if run_phase1:
        phase1_requests()

    if run_phase2:
        asyncio.run(phase2_playwright(headful=args.headful))

    print_summary()
    save_manifest()

    log.info("Done. Inspect output/ to verify content before building the extraction layer.")


if __name__ == "__main__":
    main()
