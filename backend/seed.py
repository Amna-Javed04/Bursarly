import os
import sys
import uuid
from datetime import date, datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure parent directory is in path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import Base
from app import models

# Setup engine and session
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)

def seed_db():
    # Automatically build database tables for local SQLite testing
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Cleaning up old seed data...")
        # Since we use CASCADE on delete, deleting scholarships will delete deadlines, documents, etc.
        db.query(models.Scholarship).delete()
        db.query(models.User).delete()
        db.commit()

        print("Seeding database...")

        # 1. GKS (Global Korea Scholarship)
        gks = models.Scholarship(
            id=uuid.uuid4(),
            name="Global Korea Scholarship (GKS)",
            country="South Korea",
            degree_level="Graduate & Undergraduate",
            funding_type="Full Funding",
            official_url="https://www.studyinkorea.go.kr",
            status="approved",
            source_type="manual"
        )
        db.add(gks)
        
        gks_deadlines = [
            models.ScholarshipDeadline(scholarship_id=gks.id, deadline_date=date(2026, 10, 20), cycle_year=2026, deadline_type="Undergraduate Embassy Track Application"),
            models.ScholarshipDeadline(scholarship_id=gks.id, deadline_date=date(2027, 2, 15), cycle_year=2027, deadline_type="Graduate Track Application")
        ]
        gks_docs = [
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="Official Transcript", is_required=True),
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="Graduation / Degree Certificate", is_required=True),
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="Recommendation Letters (2)", is_required=True),
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="Study Plan", is_required=True),
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="Personal Statement", is_required=True),
            models.ScholarshipDocument(scholarship_id=gks.id, document_name="TOPIK Korean Language Certificate", is_required=False)
        ]
        gks_eligibility = [
            models.ScholarshipEligibility(scholarship_id=gks.id, criteria_text="Applicant and parents must be citizens of a country other than South Korea."),
            models.ScholarshipEligibility(scholarship_id=gks.id, criteria_text="Must be under 25 years old for Undergraduate, under 40 years old for Graduate programs."),
            models.ScholarshipEligibility(scholarship_id=gks.id, criteria_text="Cumulative Grade Point Average (CGPA) must be 80% or higher from the previously attended institution, or rank in the top 20% in their class.")
        ]
        gks_resources = [
            models.Resource(scholarship_id=gks.id, help_category="essay_help", resource_type="youtube_video", title="How to Write a Winning GKS Personal Statement & Study Plan", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True),
            models.Resource(scholarship_id=gks.id, help_category="recommendation_letter", resource_type="article", title="Securing Strong GKS Reference Letters: A Complete Guide", url="https://www.studyinkorea.go.kr/en/sub/gks/gks_recommendation.do", is_free=True),
            models.Resource(scholarship_id=gks.id, help_category="application_process", resource_type="youtube_video", title="Embassy Track vs University Track: Detailed Comparison", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True)
        ]
        db.add_all(gks_deadlines + gks_docs + gks_eligibility + gks_resources)

        # 2. DAAD Scholarship
        daad = models.Scholarship(
            id=uuid.uuid4(),
            name="DAAD EPOS Scholarship",
            country="Germany",
            degree_level="Master's & PhD",
            funding_type="Full Funding",
            official_url="https://www.daad.de",
            status="approved",
            source_type="manual"
        )
        db.add(daad)

        daad_deadlines = [
            models.ScholarshipDeadline(scholarship_id=daad.id, deadline_date=date(2026, 10, 31), cycle_year=2026, deadline_type="EPOS Application Deadline (Varies by Program)")
        ]
        daad_docs = [
            models.ScholarshipDocument(scholarship_id=daad.id, document_name="Europass format CV (signed)", is_required=True),
            models.ScholarshipDocument(scholarship_id=daad.id, document_name="Letter of Motivation (signed)", is_required=True),
            models.ScholarshipDocument(scholarship_id=daad.id, document_name="University Certificate & Transcripts", is_required=True),
            models.ScholarshipDocument(scholarship_id=daad.id, document_name="Proof of at least 2 years of professional experience", is_required=True),
            models.ScholarshipDocument(scholarship_id=daad.id, document_name="English or German Language Certificate (IELTS/TOEFL/TestDaF)", is_required=True)
        ]
        daad_eligibility = [
            models.ScholarshipEligibility(scholarship_id=daad.id, criteria_text="Must have a Bachelor's degree in a related subject area (usually 4 years)."),
            models.ScholarshipEligibility(scholarship_id=daad.id, criteria_text="Must have at least two years of relevant professional work experience after completing Bachelor's degree."),
            models.ScholarshipEligibility(scholarship_id=daad.id, criteria_text="Academic degrees should normally not be older than six years.")
        ]
        daad_resources = [
            models.Resource(scholarship_id=daad.id, help_category="essay_help", resource_type="article", title="Writing a Standout DAAD Letter of Motivation", url="https://www.daad.de/en/study-and-research-in-germany/scholarships/writing-motivation-letter/", is_free=True),
            models.Resource(scholarship_id=daad.id, help_category="application_process", resource_type="youtube_video", title="Step-by-Step DAAD Scholarship Portal Application Tutorial", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True)
        ]
        db.add_all(daad_deadlines + daad_docs + daad_eligibility + daad_resources)

        # 3. Türkiye Bursları
        turkey = models.Scholarship(
            id=uuid.uuid4(),
            name="Türkiye Bursları (Turkey Scholarships)",
            country="Turkey",
            degree_level="Bachelor's, Master's & PhD",
            funding_type="Full Funding",
            official_url="https://www.turkiyeburslari.gov.tr",
            status="approved",
            source_type="manual"
        )
        db.add(turkey)

        turkey_deadlines = [
            models.ScholarshipDeadline(scholarship_id=turkey.id, deadline_date=date(2027, 2, 20), cycle_year=2027, deadline_type="General Application Deadline")
        ]
        turkey_docs = [
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="Valid ID / Passport", is_required=True),
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="Recent Photograph", is_required=True),
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="National / International Exam Results (if any)", is_required=False),
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="Transcripts and Graduation Certificates", is_required=True),
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="Letter of Intent", is_required=True),
            models.ScholarshipDocument(scholarship_id=turkey.id, document_name="Reference Letters (2)", is_required=True)
        ]
        turkey_eligibility = [
            models.ScholarshipEligibility(scholarship_id=turkey.id, criteria_text="Must be under 21 for Bachelor's, under 30 for Master's, and under 35 for PhD."),
            models.ScholarshipEligibility(scholarship_id=turkey.id, criteria_text="Minimum academic achievement: 70% for Bachelor's, 75% for Master's/PhD, and 90% for Medical Sciences."),
            models.ScholarshipEligibility(scholarship_id=turkey.id, criteria_text="Citizens of Turkey or those who have lost Turkish citizenship cannot apply.")
        ]
        turkey_resources = [
            models.Resource(scholarship_id=turkey.id, help_category="essay_help", resource_type="youtube_video", title="How to Write the Letter of Intent for Türkiye Bursları", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True),
            models.Resource(scholarship_id=turkey.id, help_category="interview_prep", resource_type="article", title="Türkiye Bursları Scholarship Interview Questions & Prep Guide", url="https://www.turkiyeburslari.gov.tr/interview-guide", is_free=True)
        ]
        db.add_all(turkey_deadlines + turkey_docs + turkey_eligibility + turkey_resources)

        # 4. Erasmus Mundus Joint Master Degrees (EMJMD)
        erasmus = models.Scholarship(
            id=uuid.uuid4(),
            name="Erasmus Mundus Joint Master Degrees",
            country="European Union",
            degree_level="Master's",
            funding_type="Full Funding",
            official_url="https://ec.europa.eu/programmes/erasmus-plus/opportunities/individuals/students/erasmus-mundus-joint-master-degrees_en",
            status="approved",
            source_type="manual"
        )
        db.add(erasmus)

        erasmus_deadlines = [
            models.ScholarshipDeadline(scholarship_id=erasmus.id, deadline_date=date(2027, 1, 15), cycle_year=2027, deadline_type="Joint Program Application (Varies slightly by consortium)")
        ]
        erasmus_docs = [
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="Bachelor's Degree Certificate", is_required=True),
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="Academic Transcripts", is_required=True),
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="Two Letters of Recommendation", is_required=True),
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="Motivation Letter", is_required=True),
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="CV (Europass Format)", is_required=True),
            models.ScholarshipDocument(scholarship_id=erasmus.id, document_name="English Language Certificate (IELTS/TOEFL)", is_required=True)
        ]
        erasmus_eligibility = [
            models.ScholarshipEligibility(scholarship_id=erasmus.id, criteria_text="Must have completed a Bachelor's degree or equivalent (or be in the final year of studies)."),
            models.ScholarshipEligibility(scholarship_id=erasmus.id, criteria_text="Must not have received an Erasmus Mundus Joint Master Degree scholarship before."),
            models.ScholarshipEligibility(scholarship_id=erasmus.id, criteria_text="Open to students from program countries (EU) and partner countries (rest of the world).")
        ]
        erasmus_resources = [
            models.Resource(scholarship_id=erasmus.id, help_category="essay_help", resource_type="youtube_video", title="How to Write an Outstanding Erasmus Mundus Motivation Letter", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True),
            models.Resource(scholarship_id=erasmus.id, help_category="recommendation_letter", resource_type="article", title="Erasmus Mundus Recommendation Letter Structure & Guidelines", url="https://ec.europa.eu/programmes/erasmus-plus/node_en", is_free=True)
        ]
        db.add_all(erasmus_deadlines + erasmus_docs + erasmus_eligibility + erasmus_resources)

        # 5. MEXT Scholarship
        mext = models.Scholarship(
            id=uuid.uuid4(),
            name="MEXT Japanese Government Scholarship",
            country="Japan",
            degree_level="Undergraduate & Graduate",
            funding_type="Full Funding",
            official_url="https://www.mext.go.jp",
            status="approved",
            source_type="manual"
        )
        db.add(mext)

        mext_deadlines = [
            models.ScholarshipDeadline(scholarship_id=mext.id, deadline_date=date(2027, 6, 10), cycle_year=2027, deadline_type="Embassy Recommendation Track Deadline (Estimated)")
        ]
        mext_docs = [
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Application Form", is_required=True),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Placement Preference Application Form (Graduate)", is_required=False),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Field of Study and Research Plan (Graduate)", is_required=True),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Academic Transcripts", is_required=True),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Graduation Certificate", is_required=True),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Recommendation Letter from Dean or Advisor", is_required=True),
            models.ScholarshipDocument(scholarship_id=mext.id, document_name="Certificate of Health", is_required=True)
        ]
        mext_eligibility = [
            models.ScholarshipEligibility(scholarship_id=mext.id, criteria_text="Must be a citizen of a country that has diplomatic relations with Japan."),
            models.ScholarshipEligibility(scholarship_id=mext.id, criteria_text="Must be under 35 years of age for Research Students (Graduate), and under 24 years of age for Undergraduate Students."),
            models.ScholarshipEligibility(scholarship_id=mext.id, criteria_text="Must be willing to learn the Japanese language and adapt to Japanese culture.")
        ]
        mext_resources = [
            models.Resource(scholarship_id=mext.id, help_category="application_process", resource_type="youtube_video", title="How to Write a Perfect MEXT Research Proposal Plan", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", is_free=True),
            models.Resource(scholarship_id=mext.id, help_category="interview_prep", resource_type="article", title="MEXT Scholarship Written Exams & Interview Prep Strategies", url="https://www.mext.go.jp/en/index.htm", is_free=True)
        ]
        db.add_all(mext_deadlines + mext_docs + mext_eligibility + mext_resources)

        db.commit()
        print("Database seeded successfully with 5 scholarships!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
