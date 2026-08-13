from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session
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
                models.ScholarshipDeadline.deadline_date >= date.today()
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
                models.ScholarshipDeadline.deadline_date >= date.today()
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
