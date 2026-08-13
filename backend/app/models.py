import json
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Integer, ForeignKey, Text, 
    UniqueConstraint, TypeDecorator, TEXT
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.database import Base

# Custom TypeDecorator for handling PostgreSQL ARRAY of Strings while falling back
# to JSON-serialized strings on SQLite databases.
class StringArray(TypeDecorator):
    impl = TEXT
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(String(100)))
        return dialect.type_descriptor(TEXT)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        if dialect.name == "postgresql":
            return value
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return []


# Custom UUID type that works as String(36) in SQLite and UUID in PostgreSQL
class GUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return uuid.UUID(value)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Supabase Auth handles it, placeholder here
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tracked_scholarships = relationship("UserScholarship", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profile"

    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    degree_level = Column(String(100), nullable=True)
    countries_of_interest = Column(StringArray, nullable=True)
    field_of_study = Column(String(255), nullable=True)
    needs_full_funding = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="profile")


class Scholarship(Base):
    __tablename__ = "scholarships"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False, index=True)
    degree_level = Column(String(100), nullable=False)
    funding_type = Column(String(100), nullable=False)
    official_url = Column(String(512), nullable=True)
    last_verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), default="pending_review", nullable=False, index=True)
    source_type = Column(String(50), default="manual", nullable=False)

    # Relationships
    deadlines = relationship("ScholarshipDeadline", back_populates="scholarship", cascade="all, delete-orphan")
    documents = relationship("ScholarshipDocument", back_populates="scholarship", cascade="all, delete-orphan")
    eligibility = relationship("ScholarshipEligibility", back_populates="scholarship", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="scholarship", cascade="all, delete-orphan")
    user_scholarships = relationship("UserScholarship", back_populates="scholarship", cascade="all, delete-orphan")


class ScholarshipDeadline(Base):
    __tablename__ = "scholarship_deadlines"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    scholarship_id = Column(GUID, ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    deadline_date = Column(Date, nullable=False, index=True)
    cycle_year = Column(Integer, nullable=False)
    deadline_type = Column(String(100), nullable=False)  # e.g., "application_deadline", "interview_deadline"

    # Relationships
    scholarship = relationship("Scholarship", back_populates="deadlines")


class ScholarshipDocument(Base):
    __tablename__ = "scholarship_documents"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    scholarship_id = Column(GUID, ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    document_name = Column(String(255), nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)

    # Relationships
    scholarship = relationship("Scholarship", back_populates="documents")


class ScholarshipEligibility(Base):
    __tablename__ = "scholarship_eligibility"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    scholarship_id = Column(GUID, ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    criteria_text = Column(Text, nullable=False)

    # Relationships
    scholarship = relationship("Scholarship", back_populates="eligibility")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    scholarship_id = Column(GUID, ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    help_category = Column(String(100), nullable=False, index=True)  # essay_help / recommendation_letter / application_process / interview_prep
    resource_type = Column(String(100), nullable=False)  # youtube_video / professional_service / institute / article
    title = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)
    is_free = Column(Boolean, default=True, nullable=False)

    # Relationships
    scholarship = relationship("Scholarship", back_populates="resources")


class UserScholarship(Base):
    __tablename__ = "user_scholarships"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scholarship_id = Column(GUID, ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="interested", nullable=False)  # interested / tracking / applied
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="tracked_scholarships")
    scholarship = relationship("Scholarship", back_populates="user_scholarships")
    reminders = relationship("ReminderLog", back_populates="user_scholarship", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "scholarship_id", name="unique_user_scholarship"),
    )


class ReminderLog(Base):
    __tablename__ = "reminder_log"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_scholarship_id = Column(GUID, ForeignKey("user_scholarships.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_type = Column(String(100), nullable=False)  # e.g., "7_days_before", "1_day_before"
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user_scholarship = relationship("UserScholarship", back_populates="reminders")
