import re
import os
import json
import urllib.request
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
    confirmed = [d for d in scholarship.deadlines if not d.is_estimated]
    variable = [d for d in scholarship.deadlines if d.is_estimated]

    deadlines_str = "\n".join(
        [f"  - VERIFIED deadline on the official page: {d.deadline_date}" for d in confirmed]
    ) if confirmed else "  - No confirmed single deadline. Dates differ by country, embassy, university or consortium track — never state a specific date for this programme."

    if variable:
        deadlines_str += (
            "\n  - There are track-specific or estimated dates, but they are NOT verified. "
            "Do not present them as deadlines; tell the user to confirm on the official page."
        )

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


# ── 3.5. RAG Web Search Helper ────────────────────────────────────

def get_web_search_results(query: str) -> str:
    """
    Performs a search using the Tavily API if TAVILY_API_KEY is configured.
    Otherwise, returns an empty string.
    """
    tavily_key = os.environ.get("TAVILY_API_KEY") or getattr(settings, "TAVILY_API_KEY", "")
    if not tavily_key or tavily_key in ["dummy-key", ""]:
        return ""

    try:
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": tavily_key,
            "query": f"{query} scholarship deadline eligibility",
            "search_depth": "basic",
            "include_answer": False,
            "max_results": 4
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            results = res_data.get("results", [])
            
            if not results:
                return ""
                
            formatted_results = []
            for r in results:
                title = r.get("title", "No Title")
                link = r.get("url", "No URL")
                content = r.get("content", "")
                formatted_results.append(f"- **Source:** {title}\n  **Link:** {link}\n  **Snippet:** {content}")
                
            return "\n\n".join(formatted_results)
            
    except Exception as e:
        print(f"Tavily search error: {e}")
        return ""


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
                "You are Bursarly's official scholarship assistant. Answer the user's question directly, "
                "thoroughly, and accurately using ONLY the verified scholarship context provided below. "
                "If the user asks about specific document requirements, recommendation letters, eligibility, or deadlines, "
                "extract and state the exact numbers, documents, or criteria listed in the context. "
                "Keep your answer clear, polite, and directly answering their question."
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

    # Perform RAG live web search if key configured
    search_context = get_web_search_results(sanitized_msg)

    if search_context:
        base_reply = generate_llm_reply(
            system_prompt=(
                "You are a helpful, professional scholarship advisor. The user is asking about a scholarship that is NOT currently "
                "in Bursarly's verified database. We performed a live web search and found some relevant information. "
                "Use the live search results below to answer the user's question as accurately and thoroughly as possible. "
                "Provide exact dates, deadlines, and eligibility criteria, and include the official URLs from the search results "
                "so the user can navigate to them directly. If the search results do not contain enough information to fully answer, "
                "you may supplement with your general knowledge, but prioritize the search results. Do not invent links."
            ),
            user_prompt=f"LIVE SEARCH RESULTS:\n{search_context}\n\nUSER QUESTION: {sanitized_msg}",
            fallback_reply=generate_unmatched_fallback(sanitized_msg)
        )
    else:
        base_reply = generate_llm_reply(
            system_prompt=(
                "You are a knowledgeable scholarship advisor. The user is asking about a scholarship that is NOT currently "
                "in Bursarly's verified database. Provide a helpful, detailed answer based on your general knowledge about "
                "this scholarship, including typical eligibility, funding scope, or application components."
            ),
            user_prompt=f"USER QUESTION: {sanitized_msg}",
            fallback_reply=generate_unmatched_fallback(sanitized_msg)
        )

    # Append mandatory disclaimer
    final_reply = base_reply.strip() + UNMATCHED_DISCLAIMER

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
    # 1. Try OpenAI if key exists
    openai_key = os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY
    if openai_key and openai_key not in ["dummy-key", ""]:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=600,
                temperature=0.3,
            )
            reply = response.choices[0].message.content.strip()
            if reply:
                return reply
        except Exception as e:
            print(f"OpenAI API call error: {e}")

    # 2. Try Gemini API if key exists
    gemini_key = os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY
    if gemini_key and gemini_key not in ["dummy-key", ""]:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\n{user_prompt}"}
                        ]
                    }
                ]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"].strip()
        except Exception as e:
            print(f"Gemini API call error: {e}")

    # 3. Deterministic intelligent fallback engine
    return fallback_reply


def generate_grounded_fallback(scholarship: models.Scholarship, message: str) -> str:
    """Deterministic fallback for grounded scholarship answers when offline or API key absent."""
    msg_lower = message.lower()

    # Document & recommendation letter queries
    doc_keywords = ["document", "requirement", "paper", "letter", "recommendation", "transcript", "essay", "sop", "statement", "certificate", "proof", "photo", "passport"]
    if any(k in msg_lower for k in doc_keywords):
        if scholarship.documents:
            doc_items = []
            for d in scholarship.documents:
                status = "Required" if d.is_required else "Optional"
                doc_items.append(f"• {d.document_name} ({status})")
            docs_list_str = "\n".join(doc_items)
            return (
                f"For {scholarship.name}, the required documents and application components listed in Bursarly are:\n\n"
                f"{docs_list_str}\n\n"
                f"Please ensure all required documents are submitted before the deadline!"
            )
        return f"For {scholarship.name}, standard application documents (official transcripts, recommendation letters, personal statement, and passport copy) are typically required."

    # Deadline queries
    if any(k in msg_lower for k in ["deadline", "when", "date", "due", "timeline"]):
        confirmed = sorted(
            [d for d in scholarship.deadlines if not d.is_estimated],
            key=lambda d: d.deadline_date,
        )
        unconfirmed = [d for d in scholarship.deadlines if d.is_estimated]

        if confirmed:
            deadline_text = (
                f"The next confirmed deadline for {scholarship.name} is "
                f"{confirmed[0].deadline_date.isoformat()}."
            )
            if len(confirmed) > 1:
                d_list = "\n".join(
                    f"• {d.deadline_date.isoformat()}" for d in confirmed
                )
                deadline_text += f"\n\nConfirmed dates listed for this programme:\n{d_list}"
            if unconfirmed:
                deadline_text += (
                    "\n\nSome tracks (country, embassy, university or consortium) set their own "
                    "dates. Those are not confirmed here — check the official page."
                )
            deadline_text += f"\n\nOfficial source: {scholarship.official_url or 'see the Bursarly listing page'}"
            return deadline_text

        return (
            f"{scholarship.name} does not publish one single application deadline — it differs by "
            "country, embassy, university or consortium track. Because Bursarly only shows dates it "
            "has confirmed on the official page, no countdown date is listed for it.\n\n"
            f"Please check the official page for your track: {scholarship.official_url or 'see the Bursarly listing page'}."
        )

    # Eligibility queries
    if any(k in msg_lower for k in ["eligibil", "who can apply", "gpa", "age", "citizen", "nationality", "degree"]):
        if scholarship.eligibility:
            elig_items = "\n".join([f"• {e.criteria_text}" for e in scholarship.eligibility])
            return (
                f"Eligibility criteria for {scholarship.name}:\n\n"
                f"{elig_items}\n\n"
                f"Degree level: {scholarship.degree_level} | Destination: {scholarship.country}."
            )
        return f"Eligibility for {scholarship.name}: degree level {scholarship.degree_level}, target country {scholarship.country}."

    # Funding & financial queries
    if any(k in msg_lower for k in ["fund", "money", "allowance", "stipend", "tuition", "cover"]):
        return (
            f"{scholarship.name} offers {scholarship.funding_type.replace('_', ' ')} funding for {scholarship.degree_level} studies in {scholarship.country}.\n"
            f"Official details: {scholarship.official_url or 'See official portal'}."
        )

    # General overview default
    docs_summary = ", ".join([d.document_name for d in scholarship.documents]) if scholarship.documents else "Standard documents"
    return (
        f"**{scholarship.name}** is a {scholarship.funding_type.replace('_', ' ')} scholarship in {scholarship.country} for {scholarship.degree_level} level studies.\n\n"
        f"• **Nearest Deadline:** {scholarship.nearest_deadline or 'N/A'}\n"
        f"• **Key Documents:** {docs_summary}\n"
        f"• **Official Source:** {scholarship.official_url or 'Available on Bursarly detail page'}"
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
    """
    Deterministic fallback for unmatched scholarship queries when offline or API key is absent.
    Provides detailed general knowledge information about popular scholarships before the disclaimer is appended.
    """
    msg_lower = message.lower()

    if "fulbright" in msg_lower:
        return (
            "The **Fulbright Program** is a flagship international educational exchange program sponsored by the U.S. government. "
            "It provides full scholarship funding for international graduate students, young professionals, and artists to study, conduct research, or teach in the United States. "
            "Funding typically covers full tuition, a monthly living stipend, health insurance, round-trip airfare, and visa assistance."
        )

    if "chevening" in msg_lower:
        return (
            "The **Chevening Scholarship** is the UK government's global scholarship program funded by the Foreign, Commonwealth & Development Office (FCDO). "
            "It offers full financial support for outstanding emerging leaders to pursue any eligible one-year Master's degree at any UK university. "
            "It includes full university tuition fees, a monthly living allowance, return flights to the UK, and essential travel grants."
        )

    if "daad" in msg_lower:
        return (
            "The **DAAD Scholarship** (German Academic Exchange Service) supports international students and scholars to study or conduct research at German universities. "
            "It generally includes a monthly stipend (approx. €934–€1,200 depending on degree level), health insurance coverage, and travel allowances for Master's and PhD programs."
        )

    if "mext" in msg_lower:
        return (
            "The **MEXT (Monbukagakusho) Scholarship** is offered by the Japanese Ministry of Education, Culture, Sports, Science and Technology. "
            "It offers 100% full funding for international students pursuing undergraduate, Master's, or PhD studies in Japan, including tuition exemption, a monthly living stipend, and round-trip airfare."
        )

    if "australia awards" in msg_lower or "aas" in msg_lower:
        return (
            "The **Australia Awards Scholarships** are prestigious international awards offered by the Australian Government for emerging leaders from developing countries. "
            "They cover full tuition fees, return air travel, establishment allowance, contribution to living expenses (CLE), and Overseas Student Health Cover (OSHC)."
        )

    if "erasmus" in msg_lower:
        return (
            "**Erasmus Mundus Joint Master Degrees (EMJMD)** are high-level integrated study programs funded by the European Union. "
            "Full scholarships cover tuition fees, library and laboratory costs, full insurance, and a monthly stipend for living expenses while studying across at least two European countries."
        )

    # General informative response for any other unmatched query
    return (
        f"Regarding your query about this scholarship: Most major international scholarship programs typically cover full or partial tuition fees, "
        f"monthly living stipends, health insurance, and travel expenses. Common requirements include academic transcripts, 2–3 recommendation letters, "
        f"a personal statement or essay, proof of language proficiency (IELTS/TOEFL/TOPIK), and passport verification."
    )
