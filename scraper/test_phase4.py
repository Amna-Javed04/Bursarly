import sys
import os
import uuid
import json
from datetime import date, timedelta
from pathlib import Path

# Setup paths
scraper_dir = Path(__file__).resolve().parent
backend_dir = scraper_dir.parent / "backend"
sys.path.append(str(backend_dir))
os.environ["DATABASE_URL"] = f"sqlite:///{backend_dir / 'bursarly.db'}"

from app.database import SessionLocal
from app.models import Scholarship, User
from app.auth import get_admin_user
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Import extractor functions
from extractor import validate_extracted_data, insert_into_database, ScholarshipSchema, DeadlineSchema

def run_tests():
    print("--- Starting Phase 4 Tests ---")
    db = SessionLocal()
    
    # 1. Scraper Content Test
    raw_text_path = scraper_dir / "output" / "gks_main_text.txt"
    print("\n1. Testing Scraper Output...")
    if raw_text_path.exists():
        content = raw_text_path.read_text(encoding="utf-8")
        if len(content) > 1000 and "Global Korea Scholarship" in content:
            print("   PASS: Scraper pulled meaningful content (length:", len(content), ")")
        else:
            print("   FAIL: Scraper content is missing or too short.")
    else:
        print("   FAIL: Scraper output file not found.")

    # 4. DB Insertion 'pending_review' Test
    print("\n4. Testing DB Insertion (Valid data -> pending_review)...")
    valid_data = ScholarshipSchema(
        name="Test Valid Scholarship",
        country="South Korea",
        degree_level="Undergraduate",
        funding_type="fully_funded",
        deadlines=[DeadlineSchema(deadline_date=(date.today() + timedelta(days=30)).isoformat(), deadline_type="app")],
        documents=[], eligibility=[]
    )
    is_valid, msg = validate_extracted_data(valid_data)
    insert_into_database(valid_data, is_valid, msg, "http://test.com")
    
    saved_valid = db.query(Scholarship).filter(Scholarship.name == "Test Valid Scholarship").first()
    if saved_valid and saved_valid.status == "pending_review":
        print("   PASS: Inserted valid scholarship with status='pending_review'")
    else:
        print("   FAIL: Valid scholarship status is", getattr(saved_valid, 'status', 'Missing'))

    # 5. DB Insertion 'needs_fix' Test (Implausible Deadline)
    print("\n5. Testing Validation Rejection (Past date -> needs_fix)...")
    invalid_data = ScholarshipSchema(
        name="Test Invalid Scholarship",
        country="South Korea",
        degree_level="Undergraduate",
        funding_type="fully_funded",
        deadlines=[DeadlineSchema(deadline_date="2020-01-01", deadline_type="app")], # Past date
        documents=[], eligibility=[]
    )
    is_valid, msg = validate_extracted_data(invalid_data)
    insert_into_database(invalid_data, is_valid, msg, "http://test.com")
    
    saved_invalid = db.query(Scholarship).filter(Scholarship.name == "Test Invalid Scholarship").first()
    if saved_invalid and saved_invalid.status == "needs_fix":
        print("   PASS: Validation rejected past date and inserted with status='needs_fix'")
    else:
        print("   FAIL: Invalid scholarship status is", getattr(saved_invalid, 'status', 'Missing'))

    # 7. Admin Endpoint Authorization Test
    # 6. Admin Panel Flow Test
    print("\n6. Testing Admin List & Actions (Approve/Reject)...")
    
    # Set up Admin User for tests
    admin_user_id = uuid.uuid4()
    admin_user = User(id=admin_user_id, email="admin@test.com", is_admin=True)
    db.add(admin_user)
    db.commit()

    # We bypass auth dependency for testing by overriding it in FastAPI
    app.dependency_overrides[get_admin_user] = lambda: admin_user_id
    
    # Check List
    response = client.get("/admin/scholarships")
    if response.status_code == 200:
        data = response.json()
        status_types = set(s['status'] for s in data)
        if status_types.issubset({"pending_review", "needs_fix"}) and len(data) > 0:
            print(f"   PASS: Admin list returned {len(data)} scholarships correctly limited to pending/needs_fix")
            
            # Test Edit/Approve
            test_id = data[0]['id']
            patch_res = client.patch(f"/admin/scholarships/{test_id}", json={"status": "approved", "name": "Approved Scholarship"})
            if patch_res.status_code == 200 and patch_res.json()["status"] == "approved" and patch_res.json()["name"] == "Approved Scholarship":
                print("   PASS: Admin PATCH correctly updated status to 'approved' and changed name")
            else:
                print("   FAIL: Admin PATCH failed:", patch_res.status_code, patch_res.text)
        else:
            print("   FAIL: Admin list returned invalid statuses or no data:", status_types)
    else:
        print("   FAIL: Admin list endpoint failed:", response.status_code)

    app.dependency_overrides.clear()
    
    print("\n7. Testing Non-Admin Authorization Block...")
    # Create a dummy non-admin user
    test_user_id = uuid.uuid4()
    dummy_user = User(id=test_user_id, email="nonadmin@test.com", is_admin=False)
    db.add(dummy_user)
    db.commit()

    try:
        # Simulate hitting the dependency
        get_admin_user(user_id=test_user_id)
        print("   FAIL: Non-admin user was not blocked!")
    except HTTPException as e:
        if e.status_code == 403:
            print("   PASS: Non-admin user was correctly blocked with 403 Forbidden.")
        else:
            print(f"   FAIL: Expected 403, got {e.status_code}")
    finally:
        # Cleanup
        db.delete(dummy_user)
        db.delete(admin_user)
        if saved_valid: db.delete(saved_valid)
        if saved_invalid: db.delete(saved_invalid)
        db.commit()

    db.close()
    print("\n--- Phase 4 Tests Completed ---")

if __name__ == "__main__":
    run_tests()
