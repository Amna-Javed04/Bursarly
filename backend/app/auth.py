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
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

logger = logging.getLogger(__name__)

# ── Bearer scheme (auto-extracts Authorization: Bearer <token>) ──
_bearer_scheme = HTTPBearer(auto_error=False)

# Pre-defined test user UUID for local SQLite dev (no auth configured)
DEFAULT_MOCK_USER_ID = "d0a1b2c3-d4e5-4f6a-8b9c-d0e1f2a3b4c5"

# Cached PyJWKClient instance for fetching Supabase's public keys
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is None and settings.SUPABASE_URL and settings.SUPABASE_URL.strip():
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def _is_auth_configured() -> bool:
    """Returns True when Supabase URL is present (production auth enabled)."""
    return bool(settings.SUPABASE_URL and settings.SUPABASE_URL.strip())


def _decode_supabase_jwt(token: str) -> dict:
    """
    Decodes and validates a Supabase-issued JWT using JWKS public keys (RS256 / ES256 / HS256).
    Raises HTTPException(401) with generic messages on any failure.
    """
    try:
        jwks_client = _get_jwks_client()
        if jwks_client:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            key = signing_key.key
        else:
            key = settings.SUPABASE_JWT_SECRET

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256", "ES256", "HS256"],
            options={"require": ["sub", "exp", "email"]},
            audience="authenticated",
        )
        return payload
    except Exception as e:
        logger.info("JWT validation failed: %s (%s)", type(e).__name__, str(e))
        if isinstance(e, jwt.ExpiredSignatureError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
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


def get_admin_user(
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> uuid.UUID:
    """Dependency to enforce admin access."""
    from app.database import SessionLocal
    from app.models import User
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required."
            )
        return user_id
    finally:
        db.close()


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> Optional[uuid.UUID]:
    """
    FastAPI dependency: resolves the authenticated user's UUID if credentials present,
    or returns None if request is anonymous.
    """
    if not credentials and not x_user_id:
        return None
    try:
        return get_current_user_id(credentials, x_user_id)
    except HTTPException:
        return None
