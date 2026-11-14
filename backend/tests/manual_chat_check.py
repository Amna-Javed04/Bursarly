import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Scholarship
from app.schemas import ChatRequest
from app.services.chatbot import process_chat_message

def test_chat():
    db = SessionLocal()
    try:
        # Get GKS scholarship
        gks = db.query(Scholarship).filter(Scholarship.name.like("%Global Korea%")).first()
        gks_id = str(gks.id) if gks else None
        print("=== TEST 1: Grounded Recommendation Letter Query ===")
        req1 = ChatRequest(message="hi. tell me how many recommendation letters do i need for GKS", scholarship_id=gks_id)
        res1 = process_chat_message(db, req1)
        print(f"Grounded: {res1.grounded}")
        print(f"Scholarship: {res1.scholarship_name}")
        print(f"REPLY:\n{res1.reply}\n")

        print("=== TEST 2: Fallback Unmatched Scholarship (Fulbright) ===")
        req2 = ChatRequest(message="what do you know about the Fulbright scholarship")
        res2 = process_chat_message(db, req2)
        print(f"Grounded: {res2.grounded}")
        print(f"Disclaimer Added: {res2.disclaimer_added}")
        print(f"REPLY:\n{res2.reply}\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_chat()
