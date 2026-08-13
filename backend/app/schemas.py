from pydantic import BaseModel, EmailStr, Field, HttpUrl
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

# --- User & Profile Schemas ---

class UserBase(BaseModel):
    email: EmailStr

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class UserProfileBase(BaseModel):
    degree_level: Optional[str] = Field(None, max_length=100, description="Degree level (e.g., Bachelor, Master, PhD)")
    countries_of_interest: Optional[List[str]] = Field(default=[], description="List of target countries")
    field_of_study: Optional[str] = Field(None, max_length=255, description="Subject area/field of study")
    needs_full_funding: bool = Field(default=False, description="Whether full funding is required")


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileResponse(UserProfileBase):
    user_id: UUID

    class Config:
        from_attributes = True


# --- Scholarship Sub-schemas ---

class ScholarshipDeadlineResponse(BaseModel):
    id: UUID
    deadline_date: date
    cycle_year: int
    deadline_type: str

    class Config:
        from_attributes = True


class ScholarshipDocumentResponse(BaseModel):
    id: UUID
    document_name: str
    is_required: bool

    class Config:
        from_attributes = True


class ScholarshipEligibilityResponse(BaseModel):
    id: UUID
    criteria_text: str

    class Config:
        from_attributes = True


class ResourceResponse(BaseModel):
    id: UUID
    help_category: str  # essay_help / recommendation_letter / application_process / interview_prep
    resource_type: str  # youtube_video / professional_service / institute / article
    title: str
    url: str
    is_free: bool

    class Config:
        from_attributes = True


# --- Scholarship Main Schemas ---

class ScholarshipListResponse(BaseModel):
    id: UUID
    name: str
    country: str
    degree_level: str
    funding_type: str
    official_url: Optional[str] = None
    last_verified_at: datetime
    nearest_deadline: Optional[date] = None

    class Config:
        from_attributes = True


class ScholarshipDetailResponse(BaseModel):
    id: UUID
    name: str
    country: str
    degree_level: str
    funding_type: str
    official_url: Optional[str] = None
    last_verified_at: datetime
    status: str
    source_type: str
    deadlines: List[ScholarshipDeadlineResponse] = []
    documents: List[ScholarshipDocumentResponse] = []
    eligibility: List[ScholarshipEligibilityResponse] = []
    resources: List[ResourceResponse] = []

    class Config:
        from_attributes = True


# --- Tracker (UserScholarship) Schemas ---

class UserScholarshipCreate(BaseModel):
    scholarship_id: UUID
    status: Optional[str] = Field(
        default="interested",
        pattern="^(interested|tracking|applied)$",
        description="Current scholarship application tracking status"
    )


class UserScholarshipUpdate(BaseModel):
    status: str = Field(
        ...,
        pattern="^(interested|tracking|applied)$",
        description="Updated scholarship application tracking status"
    )


class UserScholarshipResponse(BaseModel):
    id: UUID
    user_id: UUID
    scholarship_id: UUID
    status: str
    added_at: datetime
    scholarship: ScholarshipListResponse

    class Config:
        from_attributes = True


# --- Error Schemas ---

class ErrorDetail(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
