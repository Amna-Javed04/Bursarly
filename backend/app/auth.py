"""
auth.py — Supabase JWT verification and user identity extraction.

In LOCAL/SQLite mode (SUPABASE_JWT_SECRET is empty), the dependency
falls back to the X-User-Id header so existing dev/testing workflows
continue working without changes.

In PRODUCTION mode (SUPABASE_JWT_SECRET set), every protected endpoint
verifies the Bearer token issued by Supabase Auth, checks email
confirmation, and rejects requests with generic 401 errors (no leaks).
"""

import logging
import uuid
from typing import Optional

import jwt  # PyJWT
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

logger = logging.getLogger(__name__)

# ── Bearer scheme (auto-extracts Authorization: Bearer <token>) ──
_bearer_scheme = HTTPBearer(auto_error=False)

# Pre-defined test user UUID for local SQLite dev (no auth configured)
DEFAULT_MOCK_USER_ID = "d0a1b2c3-d4e5-4f6a-8b9c-d0e1f2a3b4c5"


def _is_auth_configured() -> bool:
    """Returns True when Supabase JWT secret is present (production mode)."""
    return bool(settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET.strip())


def _decode_supabase_jwt(token: str) -> dict:
    """
    Decodes and validates a Supabase-issued JWT.
    Raises HTTPException(401) with generic messages on any failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "email"]},
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.info("JWT validation failed: token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.info("JWT validation failed: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> uuid.UUID:
    """
    FastAPI dependency: resolves the authenticated user's UUID.

    Production path (SUPABASE_JWT_SECRET set):
      - Extracts Bearer token from Authorization header.
      - Verifies signature, expiry, and audience.
      - Checks email_confirmed_at to enforce email verification.
      - Returns UUID from the 'sub' claim.

    Development fallback (no JWT secret configured):
      - Uses X-User-Id header or DEFAULT_MOCK_USER_ID.
    """
    if _is_auth_configured():
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = _decode_supabase_jwt(credentials.credentials)

        # Enforce email verification — Supabase sets email_confirmed_at when verified
        if not payload.get("email_confirmed_at"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before accessing this resource.",
            )

        sub = payload.get("sub")
        try:
            return uuid.UUID(sub)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

    # ── Dev / local fallback ──────────────────────────────────────
    resolved_id = x_user_id or DEFAULT_MOCK_USER_ID
    try:
        return uuid.UUID(resolved_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The provided user ID is not a valid UUID format.",
        )
