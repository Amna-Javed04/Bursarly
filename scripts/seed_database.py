"""seed_database.py — copy the scholarship catalogue into the deployment database.

The catalogue (36 programmes plus their deadlines, documents, eligibility
criteria and resources) lives in the local SQLite file. Production needs it in
Postgres, so this script reads the SQLite file and inserts the same rows into
whatever `DATABASE_URL` points at. It is dialect-agnostic and safe to re-run:
existing rows are skipped unless you pass --replace.

Usage (from the repo root):

    # preview what would happen
    venv/Scripts/python.exe scripts/seed_database.py --target "postgresql://..." --dry-run

    # real run against the deployment database
    venv/Scripts/python.exe scripts/seed_database.py --target "postgresql://..."

    # or read the target from the environment / backend/.env
    DATABASE_URL="postgresql://..." venv/Scripts/python.exe scripts/seed_database.py

User accounts, their tracker rows and their preferences are deliberately not
copied: those belong to Supabase Auth and will be recreated on first sign-in.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

from sqlalchemy import Boolean, MetaData, Table, create_engine, select
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))


def normalise_url(url: str) -> str:
    """SQLAlchemy 2 rejects the legacy `postgres://` scheme Supabase hands out."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def driver_url(url: str) -> str:
    """Use whichever Postgres driver this interpreter actually has."""
    url = normalise_url(url)
    if not url.startswith("postgresql://"):
        return url
    try:
        import psycopg2  # noqa: F401

        return url
    except ImportError:
        pass
    try:
        import psycopg  # noqa: F401
    except ImportError:
        raise SystemExit(
            "No Postgres driver in this Python. Install one with:\n"
            '  python -m pip install "psycopg[binary]"'
        )
    return "postgresql+psycopg://" + url[len("postgresql://"):]


# Importing the app builds its own engine from DATABASE_URL. Give it a URL this
# interpreter can load (SQLite when nothing was set) so reading the model
# definitions never requires a Postgres driver.
_ENV_DATABASE_URL = os.environ.get("DATABASE_URL", "")
os.environ["DATABASE_URL"] = driver_url(_ENV_DATABASE_URL) if _ENV_DATABASE_URL else "sqlite:///./bursarly.db"

from app.models import Base  # noqa: E402  (needs the sys.path entry above)

# Parents before children so foreign keys resolve.
CATALOGUE_TABLES = [
    "scholarships",
    "scholarship_deadlines",
    "scholarship_documents",
    "scholarship_eligibility",
    "resources",
]
SKIPPED_TABLES = [
    "users",
    "user_profile",
    "user_scholarships",
    "user_requirement_status",
    "reminder_log",
    "unmatched_scholarship_queries",
]


def make_engine(url: str, label: str) -> Engine:
    url = driver_url(url)
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        # Resolve relative SQLite paths against backend/, not the caller's cwd.
        prefix = "sqlite:///"
        if url.startswith(prefix) and not url[len(prefix):].startswith("/"):
            url = prefix + (ROOT / "backend" / url[len(prefix):]).as_posix()
        kwargs["connect_args"] = {"check_same_thread": False}
    try:
        engine = create_engine(url, **kwargs)
        with engine.connect():
            pass
    except Exception as exc:  # noqa: BLE001 - reported verbatim to the operator
        raise SystemExit(f"Could not connect to the {label} database: {exc}") from exc
    print(f"  {label}: {engine.url.render_as_string(hide_password=True)}")
    return engine


def coerce(row: dict, table: Table) -> dict:
    """SQLite stores UUIDs as text, booleans as 0/1 and arrays as JSON text."""
    out = {}
    for name, value in row.items():
        column = table.c.get(name)
        if column is None:
            continue
        type_name = column.type.__class__.__name__
        if type_name == "GUID" and value is not None and not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        elif type_name == "StringArray" and isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                value = [value] if value else []
        elif isinstance(column.type, Boolean) and value is not None:
            value = bool(value)
        out[name] = value
    return out


def sync_table(
    target: Engine, source: Engine, name: str, source_table: Table, dry_run: bool, replace: bool
) -> tuple[int, int, int]:
    target_table = Base.metadata.tables[name]
    with source.connect() as src, target.connect() as dst:
        rows = [dict(r._mapping) for r in src.execute(select(source_table))]
        key = next(iter(target_table.primary_key.columns)).name
        existing = {row[0] for row in dst.execute(select(target_table.c[key]))}

        inserts, updates, skipped = [], [], 0
        for raw in rows:
            row = coerce(raw, target_table)
            if row.get(key) in existing:
                if replace:
                    values = {k: v for k, v in row.items() if k != key}
                    dst.execute(target_table.update().where(target_table.c[key] == row[key]).values(**values))
                    updates.append(row)
                else:
                    skipped += 1
            else:
                inserts.append(row)

        if inserts and not dry_run:
            dst.execute(target_table.insert(), inserts)
        if not dry_run:
            dst.commit()
        return len(inserts), len(updates), skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy the Bursarly catalogue into a deployment database.")
    parser.add_argument("--source", help="SQLite file to read (default: backend/bursarly.db)")
    parser.add_argument("--target", help="SQLAlchemy URL to write to (default: $DATABASE_URL)")
    parser.add_argument("--replace", action="store_true", help="Update rows that already exist instead of skipping them")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be copied without writing")
    args = parser.parse_args()

    source_path = Path(args.source) if args.source else ROOT / "backend" / "bursarly.db"
    if not source_path.exists():
        raise SystemExit(f"Source database not found: {source_path}")

    target_url = args.target or _ENV_DATABASE_URL
    if not target_url:
        raise SystemExit(
            "No target database. Pass --target postgresql://... or set DATABASE_URL.\n"
            "Find it in Supabase → Project Settings → Database → Connection string (use the pooler host, port 6543)."
        )

    print("Seeding the catalogue")
    source = make_engine(f"sqlite:///{source_path.as_posix()}", "source")
    target = make_engine(target_url, "target")

    if target.dialect.name == "postgresql" and "sslmode" not in target.url.query:
        print("  note: add ?sslmode=require to the Supabase URL if the connection is refused")

    Base.metadata.create_all(bind=target)
    print("  schema ensured (missing tables created)")

    metadata = MetaData()
    totals = {"inserted": 0, "updated": 0, "skipped": 0}
    for name in CATALOGUE_TABLES:
        try:
            source_table = Table(name, metadata, autoload_with=source)
        except Exception:  # noqa: BLE001 - table may be absent in an old database
            print(f"  {name:26} skipped (not present in source)")
            continue
        inserted, updated, skipped = sync_table(target, source, name, source_table, args.dry_run, args.replace)
        totals["inserted"] += inserted
        totals["updated"] += updated
        totals["skipped"] += skipped
        verb = "would insert" if args.dry_run else "inserted"
        print(f"  {name:26} {verb} {inserted:4}  updated {updated:3}  already present {skipped:3}")

    print(
        f"\n{'Dry run: ' if args.dry_run else ''}"
        f"{totals['inserted']} inserted, {totals['updated']} updated, {totals['skipped']} unchanged."
    )
    print(f"Not copied (user data): {', '.join(SKIPPED_TABLES)}")
    if not args.dry_run:
        print("\nNext: redeploy the API, then confirm GET /scholarships returns 36 programmes.")


if __name__ == "__main__":
    main()
