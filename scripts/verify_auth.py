#!/usr/bin/env python
"""
verify_auth.py — end-to-end check of Supabase auth + the Bursarly API.

It creates a temporary, email-confirmed user with the service-role key, logs in
with a password grant, exercises the protected endpoints, and deletes the user
afterwards. It prints statuses only: never tokens, keys or emails.

Usage (servers running):
    python scripts/verify_auth.py
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "http://127.0.0.1:8000"

failures: list[str] = []


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


def call(method: str, url: str, *, headers: dict | None = None, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    if data:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {"raw": raw[:120].decode("utf-8", "replace")}
        return exc.code, payload
    except Exception as exc:  # noqa: BLE001
        return None, {"error": type(exc).__name__}


def check(label: str, actual, expected) -> None:
    good = actual in expected if isinstance(expected, tuple) else actual == expected
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {actual}")
    if not good:
        failures.append(f"{label} (got {actual}, expected {expected})")


def main() -> int:
    backend = parse_env(ROOT / "backend" / ".env")
    frontend = parse_env(ROOT / "frontend" / ".env.local")

    url = backend.get("SUPABASE_URL", "").rstrip("/")
    anon = frontend.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    service = backend.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not (url and anon and service):
        print("Missing SUPABASE_URL, anon key or service-role key; run check_setup.py first.")
        return 1

    email = f"codebuff-check-{uuid.uuid4().hex[:10]}@example.com"
    password = f"Check-{uuid.uuid4().hex[:12]}-aA1!"

    admin_headers = {"apikey": service, "Authorization": f"Bearer {service}"}
    anon_headers = {"apikey": anon}

    print("0. Create a temporary confirmed user")
    status, created = call(
        "POST",
        f"{url}/auth/v1/admin/users",
        headers=admin_headers,
        body={"email": email, "password": password, "email_confirm": True},
    )
    check("admin user create", status, 200)
    user_id = (created or {}).get("id")
    if not user_id:
        print("  cannot continue without a user id")
        return 1

    try:
        print("\n1. Password grant (this is what the browser does on login)")
        status, session = call(
            "POST",
            f"{url}/auth/v1/token?grant_type=password",
            headers=anon_headers,
            body={"email": email, "password": password},
        )
        check("password grant", status, 200)
        token = (session or {}).get("access_token")
        if not token:
            print("  no access token returned")
            return 1

        claims = json.loads(
            urllib.request.urlopen(
                urllib.request.Request(f"{url}/auth/v1/user", headers={**anon_headers, "Authorization": f"Bearer {token}"})
            ).read()
        )
        print(f"  confirmed user has email_confirmed_at: {'email_confirmed_at' in claims and bool(claims['email_confirmed_at'])}")

        auth = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        print("\n2. Backend accepts the Supabase token")
        check("GET /user-profile/me", call("GET", f"{API}/user-profile/me", headers=auth)[0], 200)
        check("GET /user-scholarships/me", call("GET", f"{API}/user-scholarships/me", headers=auth)[0], 200)

        print("\n3. Profile write")
        status, _ = call(
            "PUT",
            f"{API}/user-profile/me",
            headers=auth,
            body={"degree_level": "Master's", "countries_of_interest": ["Germany"], "needs_full_funding": True},
        )
        check("PUT /user-profile/me", status, 200)

        print("\n4. Tracker write")
        status, listing = call("GET", f"{API}/scholarships")
        check("GET /scholarships", status, 200)
        scholarship_id = listing[0]["id"] if listing else None
        tracker_body = {"scholarship_id": scholarship_id, "status": "interested"}
        status, tracked = call("POST", f"{API}/user-scholarships", headers=auth, body=tracker_body)
        check("POST /user-scholarships", status, (200, 201))
        tracker_id = (tracked or {}).get("id")
        if tracker_id:
            check(
                "PATCH /user-scholarships status",
                call("PATCH", f"{API}/user-scholarships/{tracker_id}", headers=auth, body={"status": "tracking"})[0],
                200,
            )
            check("DELETE /user-scholarships", call("DELETE", f"{API}/user-scholarships/{tracker_id}", headers=auth)[0], 204)

        print("\n5. Admin gate")
        check("admin without flag", call("GET", f"{API}/admin/source-health", headers=auth)[0], 403)

        sys.path.insert(0, str(ROOT / "backend"))
        import sqlite3

        db = sqlite3.connect(ROOT / "backend" / "bursarly.db")
        db.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (user_id,))
        db.commit()
        check("admin with flag", call("GET", f"{API}/admin/source-health", headers=auth)[0], 200)
        db.execute("UPDATE users SET is_admin = 0 WHERE id = ?", (user_id,))
        db.commit()
        db.close()

        print("\n6. Rejections")
        check("no token", call("GET", f"{API}/user-profile/me")[0], 401)
        check("garbage token", call("GET", f"{API}/user-profile/me", headers={"Authorization": "Bearer not-a-jwt"})[0], 401)
        foreign = {"Authorization": "Bearer " + re.sub(r".", "a", token)}
        check("tampered token", call("GET", f"{API}/user-profile/me", headers=foreign)[0], 401)
    finally:
        print("\n7. Cleanup")
        check("delete temporary user", call("DELETE", f"{url}/auth/v1/admin/users/{user_id}", headers=admin_headers)[0], (200, 204))
        # The API stores its own profile/tracker rows for any user id it sees.
        try:
            import sqlite3

            db = sqlite3.connect(ROOT / "backend" / "bursarly.db")
            tracker_ids = [row[0] for row in db.execute("SELECT id FROM user_scholarships WHERE user_id = ?", (user_id,))]
            for tracker_id in tracker_ids:
                db.execute("DELETE FROM user_requirement_status WHERE user_scholarship_id = ?", (tracker_id,))
            db.execute("DELETE FROM user_scholarships WHERE user_id = ?", (user_id,))
            db.execute("DELETE FROM user_profile WHERE user_id = ?", (user_id,))
            db.execute("DELETE FROM users WHERE id = ?", (user_id,))
            db.commit()
            db.close()
            print("  PASS  local rows removed")
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN  could not clean local rows: {type(exc).__name__}")

    print("\nResult:", "auth flow verified" if not failures else f"{len(failures)} failure(s)")
    for item in failures:
        print("  -", item)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
