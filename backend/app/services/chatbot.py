import re
import os
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app import models, crud, schemas
from app.config import settings

# ── 1. Prompt Injection Defense & Sanitization ─────────────────────

def sanitize_chat_input(raw_text: str) -> str:
    """
    Sanitizes user input before passing it to the LLM prompt.
    Strips prompt injection jailbreaks, delimiter hacks, and instruction override attempts.
    """
    if not raw_text:
        return ""

    sanitized = raw_text

    # Suspicious prompt injection patterns
    suspicious_patterns = [
        r"(?i)ignore\s+(all\s+)?previous\s+instructions",
        r"(?i)system\s+prompt",
        r"(?i)you\s+are\s+now",
        r"(?i)new\s+instructions\s*:",
        r"(?i)output\s+the\s+following\s*:",
        r"(?i)forget\s+everything",
        r"(?i)\binstruction\s+override\b",
        r"(?i)disregard\s+above",
        r"(?i)act\s+as\s+a",
        r"(?i)override\s+system",
        r"```",
        r"<system>",
        r"</system>",
        r"\[SYSTEM\]",
    ]

    for pattern in suspicious_patterns:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized)

    # Enforce maximum character length to prevent token overflow
    max_chars = 2000
    if len(sanitized) > max_chars:
        sanitized = sanitized[:max_chars]

    return sanitized.strip()


# ── 2. Helper: Check if Query is General App-Usage ─────────────────

APP_USAGE_KEYWORDS = [
    "how to use",
    "how do i track",
    "what is bursarly",
    "checklist",
    "deadline countdown",
    "countdown color",
    "countdown",
    "how to save",
    "dashboard",
    "my tracker",
    "onboarding",
    "preferences",
    "how does this app work",
    "what is status",
    "what is interested",
    "what is applied",
]

UNMATCHED_DISCLAIMER = (
    "\n\n*Note: This information is from general knowledge and is not verified through Bursarly. "
    "Please confirm details with the official scholarship source.*"
)


def is_app_usage_question(message: str) -> bool:
    """
    Determines if a user message is about Bursarly app features vs a scholarship query.
    """
    msg_lower = message.lower()
    return any(keyword in msg_lower for keyword in APP_USAGE_KEYWORDS)


# ── 3. Context Formatter ──────────────────────────────────────────

def format_scholarship_grounding_context(scholarship: models.Scholarship) -> str:
    """
    Formats an approved scholarship record into structured grounding context for the LLM.
    """
    deadlines_str = "\n".join(
        [f"  - {d.deadline_type or 'Deadline'}: {d.deadline_date}" for d in scholarship.deadlines]
    ) if scholarship.deadlines else "  - None listed"

    docs_str = "\n".join(
        [f"  - {d.document_name} {'(Required)' if d.is_required else '(Optional)'}" for d in scholarship.documents]
    ) if scholarship.documents else "  - None listed"

    elig_str = "\n".join(
        [f"  - {e.criteria_text}" for e in scholarship.eligibility]
    ) if scholarship.eligibility else "  - None listed"

    return f"""
VERIFIED BURSARLY SCHOLARSHIP DATA:
Name: {scholarship.name}
Country: {scholarship.country}
Degree Level: {scholarship.degree_level}
Funding Type: {scholarship.funding_type.replace('_', ' ').title()}
Official URL: {scholarship.official_url or 'N/A'}
Nearest Deadline: {scholarship.nearest_deadline or 'N/A'}

Deadlines:
{deadlines_str}

Required Documents:
{docs_str}

Eligibility Criteria:
{elig_str}
""".strip()


# ── 4. Main Chatbot Execution Service ─────────────────────────────

def process_chat_message(
    db: Session,
    request: schemas.ChatRequest
) -> schemas.ChatResponse:
    """
    Processes a chat message using Bursarly's two-tier response logic:
      - Tier 1: If scholarship_id provided (or matched in DB), answer from verified DB data.
      - Tier 2a: If general app usage question, answer directly.
      - Tier 2b: If unmatched scholarship query, log to unmatched_scholarship_queries and append disclaimer.
    """
    # 1. Sanitize user input
    sanitized_msg = sanitize_chat_input(request.message)
    if not sanitized_msg:
        return schemas.ChatResponse(
            reply="Please enter a valid question or message.",
            grounded=False,
            unmatched_query_logged=False,
            disclaimer_added=False,
        )

    # 2. Check for explicit or implicit scholarship context
    scholarship: Optional[models.Scholarship] = None
    if request.scholarship_id:
        scholarship = crud.get_approved_scholarship_with_details(db, request.scholarship_id)

    # If no explicit scholarship_id, try searching DB for matching scholarship name
    if not scholarship:
        scholarship = crud.find_matching_approved_scholarship(db, sanitized_msg)

    # 3. TIER 1: Grounded Response (Scholarship context exists in DB)
    if scholarship:
        context_str = format_scholarship_grounding_context(scholarship)
        reply_text = generate_llm_reply(
            system_prompt=(
                "You are Bursarly's official scholarship assistant. Answer the user's question "
                "accurately using ONLY the verified scholarship context provided below. "
                "Keep your answer concise, polite, and helpful."
            ),
            user_prompt=f"{context_str}\n\nUSER QUESTION: {sanitized_msg}",
            fallback_reply=generate_grounded_fallback(scholarship, sanitized_msg)
        )
        return schemas.ChatResponse(
            reply=reply_text,
            grounded=True,
            scholarship_id=scholarship.id,
            scholarship_name=scholarship.name,
            unmatched_query_logged=False,
            disclaimer_added=False,
        )

    # 4. TIER 2a: General App Usage Question
    if is_app_usage_question(sanitized_msg):
        reply_text = generate_llm_reply(
            system_prompt=(
                "You are Bursarly's friendly AI guide. Answer questions about using the Bursarly app "
                "(tracking deadlines, deadline countdown colors, checklists, preferences, onboarding). "
                "Be helpful and concise."
            ),
            user_prompt=f"USER QUESTION: {sanitized_msg}",
            fallback_reply=generate_app_usage_fallback(sanitized_msg)
        )
        return schemas.ChatResponse(
            reply=reply_text,
            grounded=False,
            unmatched_query_logged=False,
            disclaimer_added=False,
        )

    # 5. TIER 2b: Unmatched Scholarship Query
    # Log query to DB as signal for future scholarship additions
    crud.log_unmatched_scholarship_query(db, query_text=sanitized_msg)

    base_reply = generate_llm_reply(
        system_prompt=(
            "You are a helpful scholarship advisor. The user is asking about a scholarship that is NOT currently "
            "in Bursarly's verified database. Provide a concise response based on general knowledge if possible, "
            "and encourage them to check official sources."
        ),
        user_prompt=f"USER QUESTION: {sanitized_msg}",
        fallback_reply=generate_unmatched_fallback(sanitized_msg)
    )

    # Append mandatory disclaimer
    final_reply = base_reply + UNMATCHED_DISCLAIMER

    return schemas.ChatResponse(
        reply=final_reply,
        grounded=False,
        unmatched_query_logged=True,
        disclaimer_added=True,
    )


# ── 5. LLM API Invocation & Fallbacks ──────────────────────────────

def generate_llm_reply(system_prompt: str, user_prompt: str, fallback_reply: str) -> str:
    """
    Calls OpenAI API or Gemini API if credentials exist; otherwise returns intelligent fallback response.
    """
    openai_key = os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY
    if openai_key and openai_key != "dummy-key":
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=500,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI API call error: {e}")

    return fallback_reply


def generate_grounded_fallback(scholarship: models.Scholarship, message: str) -> str:
    """Deterministic fallback for grounded scholarship answers when offline."""
    msg_lower = message.lower()
    if "deadline" in msg_lower:
        deadline_text = f"The nearest upcoming deadline for {scholarship.name} is {scholarship.nearest_deadline or 'not specified'}."
        if scholarship.deadlines:
            d_list = ", ".join([f"{d.deadline_type}: {d.deadline_date}" for d in scholarship.deadlines])
            deadline_text += f" All listed deadlines: {d_list}."
        return deadline_text

    if "document" in msg_lower or "requirement" in msg_lower or "paper" in msg_lower:
        if scholarship.documents:
            docs = ", ".join([d.document_name for d in scholarship.documents])
            return f"The required application documents for {scholarship.name} include: {docs}."
        return f"For {scholarship.name}, standard application documents (transcripts, recommendation letters, passport) are typically required."

    if "eligibil" in msg_lower or "who can apply" in msg_lower or "gpa" in msg_lower:
        if scholarship.eligibility:
            elig = "; ".join([e.criteria_text for e in scholarship.eligibility])
            return f"Eligibility criteria for {scholarship.name}: {elig}."
        return f"Eligibility for {scholarship.name}: degree level {scholarship.degree_level}, destination {scholarship.country}."

    return (
        f"{scholarship.name} is a {scholarship.funding_type.replace('_', ' ')} scholarship in {scholarship.country} "
        f"for {scholarship.degree_level} level studies. Nearest deadline: {scholarship.nearest_deadline or 'N/A'}. "
        f"Official link: {scholarship.official_url or 'Available on Bursarly detail page'}."
    )


def generate_app_usage_fallback(message: str) -> str:
    """Deterministic fallback for app usage questions."""
    msg_lower = message.lower()
    if "track" in msg_lower or "add" in msg_lower:
        return "To track a scholarship, browse scholarships on Bursarly and click '+ Add to My Tracker'. You can then monitor deadline countdowns and track completed documents on your Dashboard."
    if "checklist" in msg_lower or "document" in msg_lower:
        return "Your Dashboard includes a personal checklist for each tracked scholarship. Application documents can be ticked as completed, and eligibility criteria can be checked off as self-assessment."
    if "countdown" in msg_lower or "color" in msg_lower:
        return "The deadline countdown bar uses visual color cues: Green means >30 days remaining, Amber means 8–30 days remaining, and Red (pulsing) indicates an urgent deadline (≤7 days remaining)."
    return "Bursarly helps you discover international scholarships, track upcoming application deadlines with color-coded visual cues, and manage your required document checklists on your personalized Dashboard."


def generate_unmatched_fallback(message: str) -> str:
    """Deterministic fallback for unmatched scholarship queries."""
    return (
        f"Thank you for asking about this scholarship. Bursarly is continuously expanding its verified scholarship database. "
        f"We have noted your interest in this query and our team will work on verifying and adding it soon!"
    )
