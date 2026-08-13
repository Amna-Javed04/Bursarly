import os
import sys
import json
import re
from datetime import date, timedelta
from typing import List, Optional
from pathlib import Path

from pydantic import BaseModel, Field, field_validator, ValidationError

# Add backend directory to path to import models and db
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_dir))

# Ensure it connects to the existing DB, not a new one in the scraper folder
os.environ["DATABASE_URL"] = f"sqlite:///{backend_dir / 'bursarly.db'}"

from app.database import SessionLocal
from app.models import Scholarship, ScholarshipDeadline, ScholarshipDocument, ScholarshipEligibility

# Optional: using openai client for standard structured output (could point to OpenAI, Gemini, etc.)
try:
    from openai import OpenAI
except ImportError:
    print("Please install openai: pip install openai pydantic")
    sys.exit(1)

# ── Pydantic Schema for LLM Extraction ────────────────────────

class DeadlineSchema(BaseModel):
    deadline_date: Optional[str] = Field(description="YYYY-MM-DD format or null if ambiguous/not found")
    deadline_type: str = Field(description="e.g. 'application_deadline', 'embassy_track', 'university_track'")

class ScholarshipSchema(BaseModel):
    name: Optional[str]
    country: Optional[str]
    degree_level: Optional[str] = Field(description="e.g., Undergraduate, Graduate, Master's, PhD")
    funding_type: str = Field(description="Must be 'fully_funded', 'partially_funded', or 'unknown'")
    deadlines: List[DeadlineSchema]
    documents: List[str]
    eligibility: List[str]

# ── 1. Sanitization (Basic Prompt Injection Defense) ──────────

def sanitize_text(raw_text: str) -> str:
    """
    Strips anything resembling an embedded instruction to the LLM.
    Because the scraped page is untrusted input, we remove obvious jailbreaks.
    """
    # Regex patterns targeting common injection phrases
    suspicious_patterns = [
        r"(?i)ignore previous instructions",
        r"(?i)ignore all previous",
        r"(?i)system prompt",
        r"(?i)you are now",
        r"(?i)new instructions:",
        r"(?i)output the following:",
        r"(?i)forget everything",
        r"(?i)\binstruction override\b"
    ]
    sanitized = raw_text
    for pattern in suspicious_patterns:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized)
    
    # Also limit length to prevent massive token overflow attacks
    max_chars = 30000
    if len(sanitized) > max_chars:
        sanitized = sanitized[:max_chars] + "\n...[TRUNCATED]"
    
    return sanitized

# ── 2. LLM Extraction ─────────────────────────────────────────

def extract_scholarship_data(text: str) -> ScholarshipSchema:
    """
    Passes the sanitized text to the LLM and enforces the JSON schema.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "dummy-key"))
    
    prompt = f"""
    Extract scholarship details from the following raw text scraped from a website.
    If a field isn't clearly stated, use null — never guess.
    Dates must be exactly YYYY-MM-DD or null if ambiguous.
    
    RAW TEXT:
    {text}
    """
    
    # Using OpenAI's structured outputs feature (beta.chat.completions.parse)
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini", # or whichever model is configured
        messages=[
            {"role": "system", "content": "You are a precise data extraction assistant."},
            {"role": "user", "content": prompt}
        ],
        response_format=ScholarshipSchema,
    )
    
    return response.choices[0].message.parsed

# ── 3. Server-side Validation ─────────────────────────────────

def validate_extracted_data(data: ScholarshipSchema) -> tuple[bool, str]:
    """
    Validates business rules. 
    Returns (is_valid, error_message).
    """
    if not data.name:
        return False, "Missing required field: name"
    if not data.country:
        return False, "Missing required field: country"
    if not data.degree_level:
        return False, "Missing required field: degree_level"
    if data.funding_type not in ["fully_funded", "partially_funded", "unknown"]:
        return False, f"Invalid funding_type: {data.funding_type}"

    today = date.today()
    max_date = today + timedelta(days=365 * 3) # max 3 years in future

    # Check deadlines
    if not data.deadlines:
        return False, "No deadlines extracted."

    for d in data.deadlines:
        if d.deadline_date is None:
            return False, f"Deadline date is null for type: {d.deadline_type}"
        
        try:
            d_date = date.fromisoformat(d.deadline_date)
        except ValueError:
            return False, f"Invalid date format (not YYYY-MM-DD): {d.deadline_date}"
            
        if d_date < today:
            return False, f"Deadline is in the past: {d_date}"
        if d_date > max_date:
            return False, f"Deadline is implausibly far in the future: {d_date}"

    return True, ""

# ── 4. Database Insertion ─────────────────────────────────────

def insert_into_database(data: ScholarshipSchema, is_valid: bool, validation_msg: str, source_url: str):
    """
    Inserts validated results into the database.
    If valid, status='pending_review'. 
    If invalid, status='needs_fix'.
    """
    db = SessionLocal()
    try:
        # Determine status
        status = "pending_review" if is_valid else "needs_fix"
        print(f"Insertion status will be: {status} (Reason: {validation_msg if not is_valid else 'Passed validation'})")

        # Create scholarship record
        scholarship = Scholarship(
            name=data.name or "Unknown Scholarship",
            country=data.country or "Unknown",
            degree_level=data.degree_level or "Unknown",
            funding_type=data.funding_type,
            official_url=source_url,
            status=status,
            source_type="scraper"
        )
        db.add(scholarship)
        db.flush() # get ID

        # Add deadlines
        for d in data.deadlines:
            # If invalid date, store a placeholder or skip it so it doesn't crash DB inserts
            parsed_date = None
            if d.deadline_date:
                try:
                    parsed_date = date.fromisoformat(d.deadline_date)
                except ValueError:
                    pass
            
            # Use a dummy future date if parsing failed but we must save it as 'needs_fix'
            safe_date = parsed_date or (date.today() + timedelta(days=365))

            deadline_entry = ScholarshipDeadline(
                scholarship_id=scholarship.id,
                deadline_date=safe_date,
                cycle_year=safe_date.year,
                deadline_type=d.deadline_type
            )
            db.add(deadline_entry)

        # Add documents
        for doc in data.documents:
            doc_entry = ScholarshipDocument(
                scholarship_id=scholarship.id,
                document_name=doc,
                is_required=True
            )
            db.add(doc_entry)

        # Add eligibility
        for elig in data.eligibility:
            elig_entry = ScholarshipEligibility(
                scholarship_id=scholarship.id,
                criteria_text=elig
            )
            db.add(elig_entry)

        db.commit()
        print(f"Successfully inserted '{scholarship.name}' into database with status '{status}'.")

    except Exception as e:
        db.rollback()
        print(f"Database insertion failed: {e}")
    finally:
        db.close()

# ── Main Pipeline ─────────────────────────────────────────────

def run_extraction_pipeline():
    input_file = Path(__file__).parent / "output" / "gks_main_text.txt"
    if not input_file.exists():
        print(f"Input file not found: {input_file}")
        sys.exit(1)

    print("1. Reading scraped raw text...")
    raw_text = input_file.read_text(encoding="utf-8")
    
    print("2. Sanitizing input...")
    sanitized_text = sanitize_text(raw_text)

    # We need an API key to actually run the LLM extraction
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Using dummy JSON for demonstration.")
        # Dummy data for demonstration of validation & insertion
        extracted_data = ScholarshipSchema(
            name="Global Korea Scholarship (GKS)",
            country="South Korea",
            degree_level="Undergraduate & Graduate",
            funding_type="fully_funded",
            deadlines=[
                DeadlineSchema(deadline_date=(date.today() + timedelta(days=30)).isoformat(), deadline_type="embassy_track_submission")
            ],
            documents=["Application Form", "Transcripts", "Personal Statement"],
            eligibility=["Must hold non-Korean citizenship", "Under 25 years old for Undergrad"]
        )
    else:
        print("3. Running LLM extraction...")
        try:
            extracted_data = extract_scholarship_data(sanitized_text)
        except Exception as e:
            print(f"LLM extraction failed: {e}")
            sys.exit(1)

    print("Extracted Data:", extracted_data.model_dump_json(indent=2))

    print("4. Validating data...")
    is_valid, validation_msg = validate_extracted_data(extracted_data)
    if is_valid:
        print("Validation Passed!")
    else:
        print(f"Validation Failed: {validation_msg}")

    print("5. Inserting into database...")
    insert_into_database(
        extracted_data, 
        is_valid, 
        validation_msg, 
        source_url="https://www.studyinkorea.go.kr/ko/plan/scholarship.do"
    )

if __name__ == "__main__":
    run_extraction_pipeline()
