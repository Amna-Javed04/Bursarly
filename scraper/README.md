# Bursarly data pipeline

Everything Bursarly publishes must be traceable to a scholarship provider's own page.
This folder holds the tooling that enforces that.

## The one command that matters

```bash
cd scraper
../venv/Scripts/python.exe verify_official.py --all
```

What `--all` does, in order:

1. **`--dedupe`** — merges duplicate rows for the same programme (and moves tracker
   entries to the surviving record). Duplicates are the main source of two cards
   claiming different deadlines for one scholarship.
2. **`--add`** — inserts new programmes from `OFFICIAL_SOURCES`, but only after the
   official page answers `200`. Never hand-insert a date.
3. **`--verify`** — for every scholarship:
   - fetches `official_url` and records `source_check`:
     `verified` (200), `blocked` (bot protection/TLS/network), `unreachable` (404/410);
   - cross-checks each stored deadline against the page text **and** requires a
     deadline phrase near the date. Unconfirmed dates get `is_estimated = 1`, which
     removes them from countdowns and the calendar export;
   - harvests dates that the page actually prints in a deadline sentence;
   - grades the document list: `requirements_check` = `verified` / `partial` /
     `unverified` depending on how many document names appear on the page.

Useful flags:

| Flag | Effect |
|---|---|
| `--dry-run` | report only, write nothing |
| `--verify` | verification pass only |
| `--dedupe` | merge duplicates only |
| `--add` | ingest new official sources only |

### Adding a new scholarship

1. Add an entry to `OFFICIAL_SOURCES` in `verify_official.py` (name, country, degree
   level, funding type, official URL).
2. Run `verify_official.py --add`.
3. If it says `SKIP (official page 404)`, find the current official page — do not
   guess the URL.
4. Fill in documents/eligibility from that page, then run `--verify` so the
   `requirements_check` grade reflects reality.

## Why some pages are `blocked`

Cloudflare/bot protection and TLS interception on some networks prevent automated
reads. Those records stay visible but are labelled as unreadable in the UI. Do not
"fix" this by relaxing TLS verification or by inventing dates.

## Weekly schedule (Windows)

A verification sweep takes several minutes, so run it on a schedule instead of
inside the request path.

```powershell
# scraper/run_weekly_verification.ps1 is provided
schtasks /Create /SC WEEKLY /D SUN /TN "Bursarly verification" /TR "powershell -ExecutionPolicy Bypass -File C:\Users\amnaa\Desktop\Bursarly\scraper\run_weekly_verification.ps1" /ST 03:00
```

Run `schtasks /Delete /TN "Bursarly verification"` to remove it.

## Tests

```bash
cd backend
../venv/Scripts/python.exe -m unittest discover -s tests -v
```
