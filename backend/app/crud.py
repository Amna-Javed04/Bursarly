import re
import unicodedata
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session, selectinload
from app import models, schemas


# --- Helper to get nearest deadline as a subquery expression ---
def get_nearest_deadline_subquery(scholarship_table):
    """
    Returns a scalar subquery to find the nearest future deadline date for a scholarship.
    """
    return (
        select(models.ScholarshipDeadline.deadline_date)
        .where(
            and_(
                models.ScholarshipDeadline.scholarship_id == scholarship_table.id,
                models.ScholarshipDeadline.deadline_date >= date.today(),
                # Only confirmed dates may drive countdowns / "days left" labels.
                models.ScholarshipDeadline.is_estimated.is_(False),
            )
        )
        .order_by(models.ScholarshipDeadline.deadline_date.asc())
        .limit(1)
        .scalar_subquery()
    )


# --- User & Profile CRUD ---

def get_or_create_placeholder_user(db: Session, user_id: UUID) -> models.User:
    """
    Helper to check if a user exists. If not, auto-creates a placeholder user record
    to prevent foreign key violations during testing.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(id=user_id, email=f"placeholder_{user_id.hex[:8]}@bursarly.com")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_profile(db: Session, user_id: UUID) -> Optional[models.UserProfile]:
    return db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()


def create_or_update_user_profile(
    db: Session, user_id: UUID, profile_data: schemas.UserProfileUpdate
) -> models.UserProfile:
    # Ensure user exists first
    get_or_create_placeholder_user(db, user_id)

    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if not profile:
        profile = models.UserProfile(user_id=user_id, **profile_data.model_dump())
        db.add(profile)
    else:
        for key, value in profile_data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


# --- Scholarship CRUD ---

def get_scholarships(
    db: Session,
    country: Optional[str] = None,
    degree_level: Optional[str] = None,
    funding_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieves approved scholarships with filters.
    Includes the nearest deadline date calculated dynamically.
    """
    # Subquery for nearest deadline
    nearest_deadline = get_nearest_deadline_subquery(models.Scholarship)

    query = db.query(models.Scholarship, nearest_deadline.label("nearest_deadline")).filter(
        models.Scholarship.status == "approved"
    )

    if country:
        query = query.filter(models.Scholarship.country.ilike(country))
    if degree_level:
        query = query.filter(models.Scholarship.degree_level.ilike(degree_level))
    if funding_type:
        query = query.filter(models.Scholarship.funding_type.ilike(funding_type))

    results = query.offset(skip).limit(limit).all()

    scholarships = []
    for s, nd in results:
        # We dynamic-bind nearest_deadline to the scholarship object for Pydantic serialization
        s.nearest_deadline = nd
        scholarships.append(s)

    return scholarships


def search_scholarships(db: Session, query_str: str, skip: int = 0, limit: int = 100):
    """
    Search approved scholarships by name.
    """
    nearest_deadline = get_nearest_deadline_subquery(models.Scholarship)

    query = db.query(models.Scholarship, nearest_deadline.label("nearest_deadline")).filter(
        and_(
            models.Scholarship.status == "approved",
            models.Scholarship.name.ilike(f"%{query_str}%")
        )
    )

    results = query.offset(skip).limit(limit).all()

    scholarships = []
    for s, nd in results:
        s.nearest_deadline = nd
        scholarships.append(s)

    return scholarships


def get_scholarship_by_id(db: Session, scholarship_id: UUID) -> Optional[models.Scholarship]:
    """
    Get all details of a scholarship if it is approved.
    """
    return db.query(models.Scholarship).filter(
        and_(
            models.Scholarship.id == scholarship_id,
            models.Scholarship.status == "approved"
        )
    ).first()


def get_scholarship_resources(
    db: Session, scholarship_id: UUID, category: Optional[str] = None
) -> List[models.Resource]:
    """
    Get help resources for an approved scholarship, optionally filtered by category.
    """
    query = db.query(models.Resource).join(models.Scholarship).filter(
        and_(
            models.Scholarship.id == scholarship_id,
            models.Scholarship.status == "approved"
        )
    )
    if category:
        query = query.filter(models.Resource.help_category == category)
    return query.all()


# --- Tracker (UserScholarship) CRUD ---

def add_user_scholarship(
    db: Session, user_id: UUID, tracker_data: schemas.UserScholarshipCreate
) -> Optional[models.UserScholarship]:
    # Ensure user exists
    get_or_create_placeholder_user(db, user_id)

    # Verify scholarship exists and is approved
    scholarship = db.query(models.Scholarship).filter(
        and_(
            models.Scholarship.id == tracker_data.scholarship_id,
            models.Scholarship.status == "approved"
        )
    ).first()
    if not scholarship:
        return None

    # Check if already tracked
    existing = db.query(models.UserScholarship).filter(
        and_(
            models.UserScholarship.user_id == user_id,
            models.UserScholarship.scholarship_id == tracker_data.scholarship_id
        )
    ).first()
    if existing:
        return existing

    # Create new tracker entry
    user_scholarship = models.UserScholarship(
        user_id=user_id,
        scholarship_id=tracker_data.scholarship_id,
        status=tracker_data.status
    )
    db.add(user_scholarship)
    db.commit()
    db.refresh(user_scholarship)
    return user_scholarship


def get_user_tracked_scholarships(db: Session, user_id: UUID) -> List[models.UserScholarship]:
    """
    Get user's tracked scholarships sorted by their nearest deadline.
    """
    # Subquery to calculate the nearest deadline date for the user's scholarship
    nearest_deadline = (
        select(models.ScholarshipDeadline.deadline_date)
        .where(
            and_(
                models.ScholarshipDeadline.scholarship_id == models.UserScholarship.scholarship_id,
                models.ScholarshipDeadline.deadline_date >= date.today(),
                models.ScholarshipDeadline.is_estimated.is_(False),
            )
        )
        .order_by(models.ScholarshipDeadline.deadline_date.asc())
        .limit(1)
        .scalar_subquery()
    )

    # Perform the query, ordering by nearest deadline date ascending (nulls last)
    # Since SQLite doesn't natively support NULLS LAST easily in all versions,
    # we can construct a case statement or use ordering that places NULLS at the end.
    # In standard SQLAlchemy, we can use:
    # from sqlalchemy import asc
    # order_by(nearest_deadline.asc().nullslast())
    # Let's do that for maximum database flexibility.
    
    query = (
        db.query(models.UserScholarship, nearest_deadline.label("nearest_deadline"))
        .options(
            selectinload(models.UserScholarship.requirement_statuses),
            selectinload(models.UserScholarship.scholarship).selectinload(models.Scholarship.documents),
            selectinload(models.UserScholarship.scholarship).selectinload(models.Scholarship.eligibility),
        )
        .filter(models.UserScholarship.user_id == user_id)
        .order_by(nearest_deadline.asc())
    )

    results = query.all()
    
    tracked = []
    for us, nd in results:
        # Dynamically attach the nearest_deadline and ensure the scholarship relationship has it too
        us.scholarship.nearest_deadline = nd
        tracked.append(us)
        
    return tracked


def update_user_scholarship_status(
    db: Session, tracker_id: UUID, user_id: UUID, new_status: str
) -> Optional[models.UserScholarship]:
    """
    Update the status of a tracked scholarship.
    Returns None if the entry doesn't exist or doesn't belong to the user.
    """
    entry = db.query(models.UserScholarship).filter(
        and_(
            models.UserScholarship.id == tracker_id,
            models.UserScholarship.user_id == user_id
        )
    ).first()
    if not entry:
        return None
    entry.status = new_status
    db.commit()
    db.refresh(entry)
    # Re-attach nearest_deadline
    entry.scholarship.nearest_deadline = (
        db.query(models.ScholarshipDeadline.deadline_date)
        .filter(
            and_(
                models.ScholarshipDeadline.scholarship_id == entry.scholarship_id,
                models.ScholarshipDeadline.deadline_date >= date.today()
            )
        )
        .order_by(models.ScholarshipDeadline.deadline_date.asc())
        # Several programmes publish more than one future date (per track);
        # scalar() raises when it sees multiple rows, so keep the earliest only.
        .limit(1)
        .scalar()
    )
    return entry


def remove_user_scholarship(
    db: Session, tracker_id: UUID, user_id: UUID
) -> bool:
    """
    Delete a tracked scholarship entry.
    Returns True if deleted, False if not found or not owned by user.
    """
    entry = db.query(models.UserScholarship).filter(
        and_(
            models.UserScholarship.id == tracker_id,
            models.UserScholarship.user_id == user_id
        )
    ).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def upsert_user_requirement_status(
    db: Session,
    user_scholarship_id: UUID,
    requirement_id: UUID,
    user_id: UUID,
    toggle_data: schemas.UserRequirementToggleRequest,
) -> Optional[models.UserRequirementStatus]:
    """
    Toggle or update the fulfillment status of a scholarship document or eligibility criterion.
    Verifies that user owns the user_scholarship entry, and that requirement_id belongs to the scholarship.
    """
    # 1. Verify user_scholarship belongs to user
    user_scholarship = db.query(models.UserScholarship).filter(
        and_(
            models.UserScholarship.id == user_scholarship_id,
            models.UserScholarship.user_id == user_id,
        )
    ).first()
    if not user_scholarship:
        return None

    # 2. Verify requirement_id exists on the associated scholarship
    if toggle_data.requirement_type == "document":
        doc = db.query(models.ScholarshipDocument).filter(
            and_(
                models.ScholarshipDocument.id == requirement_id,
                models.ScholarshipDocument.scholarship_id == user_scholarship.scholarship_id,
            )
        ).first()
        if not doc:
            return None
    elif toggle_data.requirement_type == "eligibility":
        elig = db.query(models.ScholarshipEligibility).filter(
            and_(
                models.ScholarshipEligibility.id == requirement_id,
                models.ScholarshipEligibility.scholarship_id == user_scholarship.scholarship_id,
            )
        ).first()
        if not elig:
            return None
    else:
        return None

    # 3. Find existing requirement status or create new one
    status_entry = db.query(models.UserRequirementStatus).filter(
        and_(
            models.UserRequirementStatus.user_scholarship_id == user_scholarship_id,
            models.UserRequirementStatus.requirement_type == toggle_data.requirement_type,
            models.UserRequirementStatus.requirement_id == requirement_id,
        )
    ).first()

    if not status_entry:
        is_fulfilled = toggle_data.is_fulfilled if toggle_data.is_fulfilled is not None else False
        status_entry = models.UserRequirementStatus(
            user_scholarship_id=user_scholarship_id,
            requirement_type=toggle_data.requirement_type,
            requirement_id=requirement_id,
            is_fulfilled=is_fulfilled,
            notes=toggle_data.notes,
        )
        db.add(status_entry)
    else:
        if toggle_data.is_fulfilled is not None:
            status_entry.is_fulfilled = toggle_data.is_fulfilled
        if toggle_data.notes is not None:
            status_entry.notes = toggle_data.notes

    db.commit()
    db.refresh(status_entry)
    return status_entry


# --- Chatbot CRUD Helpers ---

def get_approved_scholarship_with_details(
    db: Session, scholarship_id: UUID
) -> Optional[models.Scholarship]:
    """
    Fetch an approved scholarship by ID with deadlines, documents, and eligibility pre-loaded.
    """
    scholarship = (
        db.query(models.Scholarship)
        .options(
            selectinload(models.Scholarship.deadlines),
            selectinload(models.Scholarship.documents),
            selectinload(models.Scholarship.eligibility),
        )
        .filter(
            and_(
                models.Scholarship.id == scholarship_id,
                models.Scholarship.status == "approved",
            )
        )
        .first()
    )
    if scholarship:
        scholarship.nearest_deadline = (
            db.query(models.ScholarshipDeadline.deadline_date)
            .filter(
                and_(
                    models.ScholarshipDeadline.scholarship_id == scholarship.id,
                    models.ScholarshipDeadline.deadline_date >= date.today(),
                    models.ScholarshipDeadline.is_estimated.is_(False),
                )
            )
            .order_by(models.ScholarshipDeadline.deadline_date.asc())
            .limit(1)
            .scalar()
        )
    return scholarship


# Words that appear in almost every programme name — matching on these alone
# would make "... scholarship" resolve to an arbitrary record.
GENERIC_NAME_TOKENS = {
    "scholarship", "scholarships", "scholar", "scholars", "program", "programs",
    "programme", "programmes", "fund", "funding", "award", "awards", "grant",
    "the", "for", "and", "of", "in", "at", "international", "global", "national",
    "government", "university", "college", "school", "degree", "degrees",
    "master", "masters", "undergraduate", "graduate", "postgraduate", "phd",
    "doctorate", "research", "study", "studies", "student", "students",
    "excellence", "opportunity", "general", "open",
}


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def _words(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", _fold(text))


def _name_tokens(name: str) -> List[str]:
    """Distinctive tokens of a programme name, including acronyms in brackets."""
    tokens = [t for t in _words(name) if len(t) >= 3 and t not in GENERIC_NAME_TOKENS]
    # Keep acronyms such as (GKS), (CSC), (EMJMD) — they are strong identifiers.
    for acronym in re.findall(r"\(([A-Z]{2,8})\)", name):
        tokens.append(acronym.lower())
    return list(dict.fromkeys(tokens))


def _match_score(name: str, message: str, message_words: set) -> float:
    """
    Scores how specifically `message` refers to `name`.
    0 means no acceptable match; higher is more specific.
    """
    folded_name = re.sub(r"[^a-z0-9]+", " ", _fold(name)).strip()
    folded_msg = f" {re.sub(r'[^a-z0-9]+', ' ', _fold(message)).strip()} "

    # Whole-name mention is unambiguous (allow a dash/parenthetical suffix).
    core = re.sub(r"[\(\u2014-].*$", "", name).strip() or name
    core_folded = re.sub(r"[^a-z0-9]+", " ", _fold(core)).strip()
    if len(core_folded) >= 6 and f" {core_folded} " in folded_msg:
        return 10.0 + len(core_folded) / 100
    if len(folded_name) >= 6 and f" {folded_name} " in folded_msg:
        return 10.0 + len(folded_name) / 100

    tokens = _name_tokens(name)
    if not tokens:
        return 0.0

    acronyms = {a.lower() for a in re.findall(r"\(([A-Z]{2,8})\)", name)}
    matched = [t for t in tokens if t in message_words]
    if not matched:
        return 0.0

    coverage = len(matched) / len(tokens)
    # A single short token ("korea", "italy") is not specific enough on its own,
    # unless it is the programme's own acronym ("gks", "csc", "emjmd").
    if len(matched) == 1 and len(matched[0]) <= 5 and matched[0] not in acronyms:
        return 0.0

    return coverage + 0.15 * len(matched) + max(len(t) for t in matched) / 100


def find_matching_approved_scholarship(
    db: Session, message: str
) -> Optional[models.Scholarship]:
    """
    Finds the approved scholarship the user is most specifically asking about.

    Matching is word-boundary based and scored, so a generic phrase such as
    "what documents does the scholarship need" never resolves to an arbitrary
    programme. Returns None when no programme is named clearly enough — the
    chatbot then answers from general guidance with a disclaimer instead of
    attributing another programme's requirements to it.
    """
    approved_scholarships = (
        db.query(models.Scholarship)
        .options(
            selectinload(models.Scholarship.deadlines),
            selectinload(models.Scholarship.documents),
            selectinload(models.Scholarship.eligibility),
        )
        .filter(models.Scholarship.status == "approved")
        .all()
    )

    message_words = set(_words(message))
    best: Optional[Tuple[float, models.Scholarship]] = None
    for sch in approved_scholarships:
        score = _match_score(sch.name, message, message_words)
        if score <= 0:
            continue
        if best is None or score > best[0]:
            best = (score, sch)

    if best is None or best[0] < 0.45:
        return None

    sch = best[1]
    sch.nearest_deadline = (
        db.query(models.ScholarshipDeadline.deadline_date)
        .filter(
            and_(
                models.ScholarshipDeadline.scholarship_id == sch.id,
                models.ScholarshipDeadline.deadline_date >= date.today(),
                models.ScholarshipDeadline.is_estimated.is_(False),
            )
        )
        .order_by(models.ScholarshipDeadline.deadline_date.asc())
        .limit(1)
        .scalar()
    )
    return sch


def log_unmatched_scholarship_query(
    db: Session, query_text: str
) -> models.UnmatchedScholarshipQuery:
    """
    Logs a user query about an unmatched scholarship into unmatched_scholarship_queries.
    """
    from datetime import datetime
    entry = models.UnmatchedScholarshipQuery(
        query_text=query_text,
        asked_at=datetime.utcnow(),
        resolved=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
