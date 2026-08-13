import os
import sys
import logging
from datetime import date, datetime
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

# Mocking database url for local if not set
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = f"sqlite:///{backend_dir / 'bursarly.db'}"

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import SessionLocal
from app.models import User, Scholarship, UserScholarship, ScholarshipDeadline, ReminderLog

# Resend API setup
import requests

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("send_reminders")

# Configuration
TARGET_DAYS = [30, 14, 3]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
SENDER_EMAIL = "reminders@bursarly.com" # Requires verified domain on Resend

def send_email_via_resend(to_email: str, subject: str, html_body: str) -> bool:
    """Sends email using Resend API."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not found. Mock sending email to {to_email}")
        return True

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }
    
    try:
        response = requests.post("https://api.resend.com/emails", json=data, headers=headers)
        response.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        if isinstance(e, requests.exceptions.HTTPError):
            logger.error(f"Response: {e.response.text}")
        return False

def generate_email_html(scholarship_name: str, deadline_date: date, days_remaining: int, scholarship_id: str) -> str:
    """Generates a clean HTML email template matching Bursarly brand colors."""
    link = f"{FRONTEND_URL}/scholarship/{scholarship_id}"
    
    # Brand Colors: Navy (#1F3864), Teal (#2CA6A4), Warm Off-White (#F4F1EA)
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F1EA; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
            .header {{ background-color: #1F3864; padding: 30px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
            .content {{ padding: 40px 30px; color: #334155; line-height: 1.6; }}
            .content h2 {{ color: #1F3864; margin-top: 0; font-size: 20px; }}
            .deadline-box {{ background-color: #F8FAFC; border-left: 4px solid #2CA6A4; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }}
            .deadline-box p {{ margin: 5px 0; }}
            .deadline-box strong {{ color: #1F3864; }}
            .button-container {{ text-align: center; margin: 35px 0 10px; }}
            .button {{ background-color: #2CA6A4; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; display: inline-block; }}
            .footer {{ padding: 20px 30px; text-align: center; font-size: 13px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Bursarly Reminder</h1>
            </div>
            <div class="content">
                <h2>Application Deadline Approaching!</h2>
                <p>You are currently tracking <strong>{scholarship_name}</strong> on Bursarly. This is a friendly reminder that the deadline is rapidly approaching.</p>
                
                <div class="deadline-box">
                    <p><strong>Deadline Date:</strong> {deadline_date.strftime('%B %d, %Y')}</p>
                    <p><strong>Time Remaining:</strong> {days_remaining} days</p>
                </div>
                
                <p>Make sure you have all your documents ready and submitted before the deadline closes.</p>
                
                <div class="button-container">
                    <a href="{link}" class="button">View Scholarship Details</a>
                </div>
            </div>
            <div class="footer">
                <p>You received this email because you added this scholarship to your tracker.</p>
                <p>© {date.today().year} Bursarly. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def process_reminders():
    db = SessionLocal()
    today = date.today()
    
    try:
        # Fetch all user tracked scholarships that are NOT 'applied'
        tracked = db.query(UserScholarship).filter(UserScholarship.status != "applied").all()
        logger.info(f"Found {len(tracked)} active tracked scholarships.")
        
        sent_count = 0
        for tracker in tracked:
            user = db.query(User).filter(User.id == tracker.user_id).first()
            if not user or not user.email:
                continue
                
            scholarship = db.query(Scholarship).filter(Scholarship.id == tracker.scholarship_id).first()
            if not scholarship:
                continue
                
            # Find the nearest future deadline for this scholarship
            future_deadlines = [d for d in db.query(ScholarshipDeadline).filter(ScholarshipDeadline.scholarship_id == scholarship.id).all() if d.deadline_date >= today]
            if not future_deadlines:
                continue
                
            nearest_deadline = min(future_deadlines, key=lambda x: x.deadline_date)
            days_remaining = (nearest_deadline.deadline_date - today).days
            
            # Check if this matches one of our target thresholds
            if days_remaining in TARGET_DAYS:
                reminder_type = f"{days_remaining}_days"
                
                # Check reminder_log to prevent duplicates
                existing = db.query(ReminderLog).filter(
                    ReminderLog.user_scholarship_id == tracker.id,
                    ReminderLog.reminder_type == reminder_type
                ).first()
                
                if not existing:
                    logger.info(f"Sending {reminder_type} reminder to {user.email} for '{scholarship.name}'")
                    
                    subject = f"Action Required: {scholarship.name} deadline in {days_remaining} days!"
                    html_body = generate_email_html(scholarship.name, nearest_deadline.deadline_date, days_remaining, str(scholarship.id))
                    
                    success = send_email_via_resend(user.email, subject, html_body)
                    if success:
                        # Log success
                        log_entry = ReminderLog(
                            user_scholarship_id=tracker.id,
                            reminder_type=reminder_type
                        )
                        db.add(log_entry)
                        db.commit()
                        sent_count += 1
                        
        logger.info(f"Finished processing. Successfully sent {sent_count} reminders.")
    except Exception as e:
        logger.error(f"Error processing reminders: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    process_reminders()
