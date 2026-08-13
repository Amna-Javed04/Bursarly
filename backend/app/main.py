import logging
import uuid
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db, Base
from app import crud, models, schemas

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Automatically create tables for SQLite/local development on startup
# For production, Supabase migrations will handle the Postgres tables.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DATABASE_URL.startswith("sqlite") else None,  # Enable docs locally only
    redoc_url=None
)

# CORS configuration: Restrict to non-wildcard domains specified in settings
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


# --- Custom Security-Focused Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Sanitize request validation errors. Avoid leaking internal structures.
    """
    logger.warning(f"Validation error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"message": "Invalid input data provided. Please verify your inputs."}}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Ensure all HTTPExceptions return the standardized error payload schema.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail}}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all to prevent stack traces, SQL syntax, or internal IDs from leaking to clients.
    """
    logger.exception("An unhandled exception occurred in the application:")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"message": "An unexpected server error occurred. Please try again later."}}
    )


# --- Authentication Dependency (Phase 3 placeholder) ---

# Pre-defined test user UUID that client can fallback on
DEFAULT_MOCK_USER_ID = "d0a1b2c3-d4e5-4f6a-8b9c-d0e1f2a3b4c5"

def get_current_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    user_id: Optional[str] = Query(None)
) -> uuid.UUID:
    """
    Resolves the user ID. Checks X-User-Id header first, then user_id query param.
    If neither is present, defaults to DEFAULT_MOCK_USER_ID for easy testing.
    Raises 400 Bad Request if the resolved string is not a valid UUID.
    """
    resolved_id = x_user_id or user_id or DEFAULT_MOCK_USER_ID
    try:
        return uuid.UUID(resolved_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The provided user ID is not a valid UUID format."
        )


# --- Endpoints ---

@app.get("/scholarships", response_model=List[schemas.ScholarshipListResponse])
def read_scholarships(
    country: Optional[str] = Query(None, max_length=100),
    degree_level: Optional[str] = Query(None, max_length=100),
    funding_type: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db)
):
    """
    Browse scholarships with filters. Returns only approved scholarships.
    """
    return crud.get_scholarships(
        db, country=country, degree_level=degree_level, funding_type=funding_type
    )


@app.get("/scholarships/search", response_model=List[schemas.ScholarshipListResponse])
def search_scholarships(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db)
):
    """
    Search scholarships by name. Returns only approved scholarships.
    """
    return crud.search_scholarships(db, query_str=q)


@app.get("/scholarships/{id}", response_model=schemas.ScholarshipDetailResponse)
def read_scholarship(id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Get full details of a scholarship by ID. Returns only approved scholarships.
    """
    scholarship = crud.get_scholarship_by_id(db, scholarship_id=id)
    if not scholarship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved."
        )
    return scholarship


@app.get("/scholarships/{id}/resources", response_model=List[schemas.ResourceResponse])
def read_scholarship_resources(
    id: uuid.UUID,
    category: Optional[str] = Query(None, pattern="^(essay_help|recommendation_letter|application_process|interview_prep)$"),
    db: Session = Depends(get_db)
):
    """
    Get curated resources for a scholarship, optionally filtered by help category.
    """
    # Double check if scholarship exists and is approved
    scholarship = crud.get_scholarship_by_id(db, scholarship_id=id)
    if not scholarship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved."
        )
    return crud.get_scholarship_resources(db, scholarship_id=id, category=category)


@app.post("/user-scholarships", response_model=schemas.UserScholarshipResponse, status_code=status.HTTP_201_CREATED)
def add_to_tracker(
    tracker_input: schemas.UserScholarshipCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Add a scholarship to the current user's tracking list.
    """
    tracker = crud.add_user_scholarship(db, user_id=current_user_id, tracker_data=tracker_input)
    if not tracker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scholarship not found or not yet approved."
        )
    return tracker


@app.get("/user-scholarships/me", response_model=List[schemas.UserScholarshipResponse])
def read_my_tracked_scholarships(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get the current user's tracked scholarships sorted by nearest deadline.
    """
    return crud.get_user_tracked_scholarships(db, user_id=current_user_id)


@app.get("/user-profile/me", response_model=schemas.UserProfileResponse)
def read_my_profile(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get the current user's profile.
    """
    profile = crud.get_user_profile(db, user_id=current_user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete the onboarding questionnaire."
        )
    return profile


@app.put("/user-profile/me", response_model=schemas.UserProfileResponse)
def update_my_profile(
    profile_data: schemas.UserProfileUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create or update the current user's onboarding questionnaire answers.
    """
    return crud.create_or_update_user_profile(db, user_id=current_user_id, profile_data=profile_data)
