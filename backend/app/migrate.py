"""
migrate.py — tiny, idempotent schema upgrader.

`Base.metadata.create_all()` creates missing tables but never adds columns to
tables that already exist. This module fills that gap for the columns added by
the source-verification work, so existing local databases (and Supabase
projects that predate them) keep working without a full migration toolchain.
"""

import logging

from sqlalchemy import inspect, text

from app.database import engine

logger = logging.getLogger(__name__)

# (table, column, DDL type + default)
COLUMNS = [
    ("scholarships", "source_check", "VARCHAR(32) NOT NULL DEFAULT 'not_checked'"),
    ("scholarships", "source_checked_at", "TIMESTAMP NULL"),
    ("scholarship_deadlines", "is_estimated", "BOOLEAN NOT NULL DEFAULT 0"),
    ("scholarships", "requirements_check", "VARCHAR(32) NOT NULL DEFAULT 'not_checked'"),
]


def run_migrations() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl in COLUMNS:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column in columns:
                continue
            is_postgres = engine.dialect.name == "postgresql"
            statement = ddl
            if is_postgres:
                # SQLite booleans are ints; Postgres needs a real boolean default.
                statement = ddl.replace("BOOLEAN NOT NULL DEFAULT 0", "BOOLEAN NOT NULL DEFAULT FALSE")
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {statement}"))
                logger.info("Migration: added %s.%s", table, column)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Migration skipped for %s.%s: %s", table, column, exc)
