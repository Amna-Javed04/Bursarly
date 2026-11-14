#!/usr/bin/env python
"""
check_setup.py — tells you whether Bursarly's Supabase configuration is usable.

It never prints secret values: only presence, length and a short prefix.

Usage:
    python scripts/check_setup.py
"""

from __future__ import annotations

import json
import re
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV = ROOT / "backend" / ".env"
FRONTEND_ENV = ROOT / "frontend" / ".env.local"

PLACEHOLDER_MARKERS = (
    "<",
    ">",
    "your-",
    "paste",
    "change-me",
    "xxx",
    "placeholder",
)

ok_all = True


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def ok(message: str) -> None:
    print(f"  PASS  {message}")


def warn(message: str) -> None:
    print(f"  WARN  {message}")


def fail(message: str) -> None:
    global ok_all
    ok_all = False
    print(f"  FAIL  {message}")


def looks_placeholder(value: str) -> bool:
    lowered = value.lower()
    return not value or any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def describe(value: str) -> str:
    if not value:
        return "empty"
    return f"{len(value)} chars, starts '{value[:12]}'"


def http_status(url: str, timeout: float = 12) -> tuple[int | None, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status, response.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, ""
    except Exception as exc:  # noqa: BLE001 - any transport error is a failure here
        return None, type(exc).__name__


def main() -> int:
    print("Bursarly setup check\n")

    print("1. Environment files")
    backend = parse_env(BACKEND_ENV)
    frontend = parse_env(FRONTEND_ENV)

    if not backend:
        fail("backend/.env missing or empty")
    if not frontend:
        fail("frontend/.env.local missing or empty")

    backend_url = backend.get("SUPABASE_URL", "").rstrip("/")
    frontend_url = frontend.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    anon = frontend.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    service = backend.get("SUPABASE_SERVICE_ROLE_KEY", "")

    for label, value in (("backend SUPABASE_URL", backend_url), ("frontend NEXT_PUBLIC_SUPABASE_URL", frontend_url)):
        if looks_placeholder(value):
            fail(f"{label} is missing or still a placeholder")
        elif not value.startswith("https://"):
            fail(f"{label} must start with https://")
        else:
            ok(label)

    if backend_url and frontend_url and backend_url != frontend_url:
        fail("the two files point at different Supabase projects")
    elif backend_url and frontend_url:
        ok("both files point at the same project")

    print("\n2. Keys")
    if looks_placeholder(anon):
        fail(f"frontend NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or a placeholder ({describe(anon)})")
    elif anon.startswith("sb_publishable_") or anon.startswith("eyJ"):
        ok(f"publishable/anon key present ({describe(anon)})")
    else:
        fail(f"NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a Supabase key ({describe(anon)})")

    if not service:
        warn("backend SUPABASE_SERVICE_ROLE_KEY is empty — fine, the code does not call it yet")
    elif service.startswith("sb_secret_") or service.startswith("eyJ"):
        ok(f"secret/service_role key present ({describe(service)})")
    else:
        warn(f"SUPABASE_SERVICE_ROLE_KEY looks unusual ({describe(service)})")

    if service and anon and service == anon:
        fail("the secret key is being used as the public key")

    jwt_secret = backend.get("SUPABASE_JWT_SECRET", "")
    if jwt_secret:
        ok("SUPABASE_JWT_SECRET set (not required on new projects)")
    else:
        warn("SUPABASE_JWT_SECRET empty — expected: tokens are verified via JWKS")

    if not backend_url:
        print("\nCannot reach Supabase without a URL. Fix the values above first.")
        return 1

    print("\n3. Project reachability")
    host = re.sub(r"^https?://", "", backend_url).split("/")[0]
    try:
        socket.getaddrinfo(host, 443)
        ok(f"{host} resolves")
    except socket.gaierror:
        fail(f"{host} does not resolve — the project was deleted, renamed, or the ref is wrong")
        return 1

    status, _ = http_status(f"{backend_url}/auth/v1/health")
    if status == 200:
        ok("auth service healthy")
    else:
        fail(f"auth service not reachable (status {status})")

    status, body = http_status(f"{backend_url}/auth/v1/.well-known/jwks.json")
    if status == 200:
        try:
            keys = json.loads(body).get("keys", [])
        except json.JSONDecodeError:
            keys = []
        if keys:
            ok(f"JWKS exposed ({len(keys)} signing key(s)) — backend needs no JWT secret")
        else:
            warn("JWKS returned no keys; the project may still use legacy HS256 signing")
    else:
        warn(f"JWKS not readable (status {status})")

    print("\n4. Redirect URLs to allow in Supabase (Authentication → URL Configuration)")
    for url in (
        "http://localhost:3000/auth/callback",
        "http://localhost:3000/auth/reset-password",
    ):
        print(f"  -> {url}")

    print("\nResult:", "all required values look usable" if ok_all else "fix the FAIL lines above")
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
