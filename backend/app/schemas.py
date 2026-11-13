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
    # True when the date could not be confirmed on the official page — such
    # dates are shown as guidance only and never drive countdowns.
    is_estimated: bool = False

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
    source_check: str = "not_checked"
    requirements_check: str = "not_checked"

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
    source_check: str = "not_checked"
    source_checked_at: Optional[datetime] = None
    requirements_check: str = "not_checked"
    deadlines: List[ScholarshipDeadlineResponse] = []
    documents: List[ScholarshipDocumentResponse] = []
    eligibility: List[ScholarshipEligibilityResponse] = []
    resources: List[ResourceResponse] = []

    class Config:
        from_attributes = True


class AdminScholarshipUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    degree_level: Optional[str] = None
    funding_type: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(pending_review|needs_fix|approved|rejected)$")
    
# --- Requirement Status Schemas ---

class UserRequirementToggleRequest(BaseModel):
    requirement_type: str = Field(
        ...,
        pattern="^(document|eligibility)$",
        description="Type of requirement ('document' or 'eligibility')"
    )
    is_fulfilled: Optional[bool] = Field(default=None, description="Whether the requirement is fulfilled/completed")
    notes: Optional[str] = Field(default=None, max_length=1000, description="Optional personal notes")


class UserRequirementStatusResponse(BaseModel):
    id: UUID
    user_scholarship_id: UUID
    requirement_type: str
    requirement_id: UUID
    is_fulfilled: bool
    notes: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Tracker (UserScholarship) Schemas ---

class ScholarshipDetailForTracker(BaseModel):
    id: UUID
    name: str
    country: str
    degree_level: str
    funding_type: str
    official_url: Optional[str] = None
    last_verified_at: datetime
    nearest_deadline: Optional[date] = None
    documents: List[ScholarshipDocumentResponse] = []
    eligibility: List[ScholarshipEligibilityResponse] = []

    class Config:
        from_attributes = True


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
    scholarship: ScholarshipDetailForTracker
    requirement_statuses: List[UserRequirementStatusResponse] = []

    class Config:
        from_attributes = True


# --- Chatbot Schemas ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question or message for chatbot assistant")
    scholarship_id: Optional[UUID] = Field(default=None, description="Optional scholarship ID context when chatting from detail page")


class ChatResponse(BaseModel):
    reply: str
    grounded: bool
    scholarship_id: Optional[UUID] = None
    scholarship_name: Optional[str] = None
    unmatched_query_logged: bool = False
    disclaimer_added: bool = False


class UnmatchedQueryResponse(BaseModel):
    id: UUID
    query_text: str
    asked_at: datetime
    resolved: bool

    class Config:
        from_attributes = True


# --- User Scholarship Submission Schemas ---

class ScholarshipSubmitRequest(BaseModel):
    url: HttpUrl = Field(..., description="Official URL of the scholarship to submit")
    name: Optional[str] = Field(None, max_length=255, description="Scholarship name (optional, will be extracted from page if omitted)")
    country: Optional[str] = Field(None, max_length=100)
    degree_level: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000, description="Any extra context the submitter wants to add")


class ScholarshipSubmitResponse(BaseModel):
    id: UUID
    name: str
    status: str
    message: str

    class Config:
        from_attributes = True


class SourceHealthResponse(BaseModel):
    approved: int
    pending: int
    needs_fix: int
    by_source_check: dict
    blocked: List[dict]
    missing_requirements: List[dict]
    confirmed_deadlines: int
    unconfirmed_deadlines: int
    last_checked_at: Optional[datetime] = None
    recent_unmatched: List[UnmatchedQueryResponse] = []


# --- Error Schemas ---

class ErrorDetail(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
