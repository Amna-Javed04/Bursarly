import logging
import uuid
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db, Base
from app import crud, models, schemas
from app.auth import get_current_user_id, get_admin_user, get_optional_user_id
from app.services import chatbot
from app.services.calendar import build_scholarship_calendar

# ── Setup ─────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables for SQLite / local dev. In production Supabase migrations handle this.
Base.metadata.create_all(bind=engine)

# Add columns introduced after a database was first created (idempotent).
from app.migrate import run_migrations  # noqa: E402

run_migrations()

# Rate limiter — uses client IP as the key.
# In production behind a proxy, configure trusted_ips / X-Forwarded-For.
limiter = Limiter(key_func=get_remote_address, default_limits=[])

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    # Disable interactive docs in production (non-SQLite) to reduce attack surface
    docs_url="/docs" if settings.DATABASE_URL.startswith("sqlite") else None,
    redoc_url=None,
)

# Attach the rate-limiter state and its 429 handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Custom Security-Focused Exception Handlers ─────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Sanitize validation errors — never leak internal field paths."""
    logger.warning("Validation error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"message": "Invalid input data provided. Please verify your inputs."}},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Standardize all HTTP error responses to {error: {message: ...}}."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail}},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all: prevent stack traces / SQL syntax from reaching clients."""
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"message": "An unexpected server error occurred. Please try again later."}},
    )


# ── Health ────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# ── Scholarship Endpoints (public, no auth required) ──────────

@app.get("/scholarships", response_model=List[schemas.ScholarshipListResponse], tags=["scholarships"])
def read_scholarships(
    country: Optional[str] = Query(None, max_length=100),
    degree_level: Optional[str] = Query(None, max_length=100),
    funding_type: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    """Browse scholarships with optional filters. Returns only approved scholarships."""
    return crud.get_scholarships(
        db, country=country, degree_level=degree_level, funding_type=funding_type
    )


@app.get("/scholarships/search", response_model=List[schemas.ScholarshipListResponse], tags=["scholarships"])
def search_scholarships(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
):
    """Full-text search by scholarship name. Returns only approved scholarships."""
    return crud.search_scholarships(db, query_str=q)


@app.get("/scholarships/{id}", response_model=schemas.ScholarshipDetailResponse, tags=["scholarships"])
def read_scholarship(id: uuid.UUID, db: Session = Depends(get_db)):
    """Get full details of a scholarship by ID."""
    scholarship = crud.get_scholarship_by_id(db, scholarship_id=id)
    if not scholarship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved.",
        )
    return scholarship


@app.get("/scholarships/{id}/resources", response_model=List[schemas.ResourceResponse], tags=["scholarships"])
def read_scholarship_resources(
    id: uuid.UUID,
    category: Optional[str] = Query(
        None,
        pattern="^(essay_help|recommendation_letter|application_process|interview_prep)$",
    ),
    db: Session = Depends(get_db),
):
    """Get curated resources for a scholarship, optionally filtered by help category."""
    scholarship = crud.get_scholarship_by_id(db, scholarship_id=id)
    if not scholarship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved.",
        )
    return crud.get_scholarship_resources(db, scholarship_id=id, category=category)


@app.get("/scholarships/{id}/calendar.ics", tags=["scholarships"])
def export_scholarship_calendar(id: uuid.UUID, db: Session = Depends(get_db)):
    """Download an .ics calendar containing only officially confirmed deadlines."""
    scholarship = crud.get_approved_scholarship_with_details(db, scholarship_id=id)
    if not scholarship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved.",
        )

    calendar = build_scholarship_calendar(scholarship)
    if "BEGIN:VEVENT" not in calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This scholarship has no confirmed deadline to export. Check the official page.",
        )

    filename = "bursarly-deadline.ics"
    return Response(
        content=calendar,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── User Tracker Endpoints (protected — requires valid JWT) ────

@app.post(
    "/user-scholarships",
    response_model=schemas.UserScholarshipResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["tracker"],
)
@limiter.limit(settings.AUTH_RATE_LIMIT)
def add_to_tracker(
    request: Request,
    tracker_input: schemas.UserScholarshipCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add a scholarship to the authenticated user's tracking list."""
    tracker = crud.add_user_scholarship(db, user_id=current_user_id, tracker_data=tracker_input)
    if not tracker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved.",
        )
    return tracker


@app.get("/user-scholarships/me", response_model=List[schemas.UserScholarshipResponse], tags=["tracker"])
def read_my_tracked_scholarships(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the authenticated user's tracked scholarships sorted by nearest deadline."""
    return crud.get_user_tracked_scholarships(db, user_id=current_user_id)


@app.patch("/user-scholarships/{id}", response_model=schemas.UserScholarshipResponse, tags=["tracker"])
def update_tracker_status(
    id: uuid.UUID,
    update: schemas.UserScholarshipUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update the status of a tracked scholarship (interested / tracking / applied)."""
    entry = crud.update_user_scholarship_status(
        db, tracker_id=id, user_id=current_user_id, new_status=update.status
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracker entry not found.",
        )
    return entry


@app.delete("/user-scholarships/{id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tracker"])
def remove_from_tracker(
    id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a scholarship from the authenticated user's tracker."""
    deleted = crud.remove_user_scholarship(db, tracker_id=id, user_id=current_user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracker entry not found.",
        )


@app.patch(
    "/user-scholarships/{id}/requirements/{requirement_id}",
    response_model=schemas.UserRequirementStatusResponse,
    tags=["tracker"],
)
def toggle_user_requirement_status(
    id: uuid.UUID,
    requirement_id: uuid.UUID,
    toggle_input: schemas.UserRequirementToggleRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Toggle fulfillment status of a scholarship document or eligibility criterion."""
    status_entry = crud.upsert_user_requirement_status(
        db,
        user_scholarship_id=id,
        requirement_id=requirement_id,
        user_id=current_user_id,
        toggle_data=toggle_input,
    )
    if not status_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracker entry or requirement not found.",
        )
    return status_entry


@app.get("/user-profile/me", response_model=schemas.UserProfileResponse, tags=["profile"])
def read_my_profile(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the authenticated user's profile."""
    profile = crud.get_user_profile(db, user_id=current_user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete the onboarding questionnaire.",
        )
    return profile


@app.put("/user-profile/me", response_model=schemas.UserProfileResponse, tags=["profile"])
def update_my_profile(
    profile_data: schemas.UserProfileUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create or update the authenticated user's profile / onboarding answers."""
    return crud.create_or_update_user_profile(db, user_id=current_user_id, profile_data=profile_data)


# ── Admin Endpoints ───────────────────────────────────────────

@app.get("/admin/scholarships", response_model=List[schemas.ScholarshipDetailResponse], tags=["admin"])
def get_pending_scholarships(
    admin_id: uuid.UUID = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin only: list scholarships requiring review."""
    return db.query(models.Scholarship).filter(
        models.Scholarship.status.in_(["pending_review", "needs_fix"])
    ).all()


@app.patch("/admin/scholarships/{id}", response_model=schemas.ScholarshipDetailResponse, tags=["admin"])
def update_scholarship_admin(
    id: uuid.UUID,
    update_data: schemas.AdminScholarshipUpdate,
    admin_id: uuid.UUID = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin only: edit, approve, or reject a scraped scholarship."""
    scholarship = db.query(models.Scholarship).filter(models.Scholarship.id == id).first()
    if not scholarship:
        raise HTTPException(status_code=404, detail="Scholarship not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(scholarship, key, value)
        
    db.commit()
    db.refresh(scholarship)
    return scholarship


# ── Chatbot Endpoints ──────────────────────────────────────────

def get_chat_rate_limit_key(request: Request) -> str:
    """Returns key based on authorization token/header or IP address."""
    auth_header = request.headers.get("authorization") or request.headers.get("x-user-id")
    if auth_header:
        return f"user:{auth_header}"
    return f"ip:{get_remote_address(request)}"


@app.post("/chat", response_model=schemas.ChatResponse, tags=["chat"])
@limiter.limit(settings.CHAT_ANONYMOUS_RATE_LIMIT, key_func=get_chat_rate_limit_key)
def chat_with_assistant(
    request: Request,
    chat_input: schemas.ChatRequest,
    current_user_id: Optional[uuid.UUID] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """
    Chatbot endpoint providing grounded responses for scholarships or app usage,
    with prompt injection defense, rate limiting, and logging of unmatched queries.
    Works for both logged-in and anonymous users.
    """
    return chatbot.process_chat_message(db, chat_input)


@app.get("/admin/source-health", response_model=schemas.SourceHealthResponse, tags=["admin"])
def get_source_health(
    admin_id: uuid.UUID = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin only: data-quality overview built from the verification passes."""
    approved = db.query(models.Scholarship).filter(models.Scholarship.status == "approved").count()
    pending = db.query(models.Scholarship).filter(models.Scholarship.status == "pending_review").count()
    needs_fix = db.query(models.Scholarship).filter(models.Scholarship.status == "needs_fix").count()

    by_source_check = {
        key: count
        for key, count in db.query(
            models.Scholarship.source_check, func.count(models.Scholarship.id)
        ).group_by(models.Scholarship.source_check).all()
    }

    blocked = [
        {"id": str(s.id), "name": s.name, "official_url": s.official_url}
        for s in db.query(models.Scholarship).filter(models.Scholarship.source_check == "blocked").all()
    ]

    missing_requirements = [
        {"id": str(s.id), "name": s.name, "official_url": s.official_url}
        for s in db.query(models.Scholarship)
        .filter(models.Scholarship.status == "approved")
        .all()
        if not s.documents
    ]

    confirmed = (
        db.query(models.ScholarshipDeadline)
        .filter(models.ScholarshipDeadline.is_estimated.is_(False))
        .count()
    )
    unconfirmed = (
        db.query(models.ScholarshipDeadline)
        .filter(models.ScholarshipDeadline.is_estimated.is_(True))
        .count()
    )

    last_checked = db.query(func.max(models.Scholarship.source_checked_at)).scalar()

    recent_unmatched = (
        db.query(models.UnmatchedScholarshipQuery)
        .order_by(models.UnmatchedScholarshipQuery.asked_at.desc())
        .limit(20)
        .all()
    )

    return {
        "approved": approved,
        "pending": pending,
        "needs_fix": needs_fix,
        "by_source_check": by_source_check,
        "blocked": blocked,
        "missing_requirements": missing_requirements,
        "confirmed_deadlines": confirmed,
        "unconfirmed_deadlines": unconfirmed,
        "last_checked_at": last_checked,
        "recent_unmatched": recent_unmatched,
    }


@app.get("/admin/unmatched-queries", response_model=List[schemas.UnmatchedQueryResponse], tags=["admin"])
def get_unmatched_queries(
    admin_id: uuid.UUID = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin only: list unmatched user queries to inform future scholarship additions."""
    return db.query(models.UnmatchedScholarshipQuery).order_by(models.UnmatchedScholarshipQuery.asked_at.desc()).all()
