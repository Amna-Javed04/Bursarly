# Bursarly

A scholarship deadline tracker that refuses to guess. Every date is either **confirmed on the provider's own page** or clearly labelled **expected**, so you always know which one you are trusting.

Built for students applying across borders, where a missed deadline costs a year.

---

## Why it exists

Scholarship lists are easy to find. Knowing *when to apply* is not: dates differ by country, embassy, university and consortium track, and aggregator sites copy each other's stale numbers. Bursarly tracks a smaller catalogue and grades the data instead:

| Grade | Meaning | What the UI does |
|---|---|---|
| `is_estimated = false` | The date appears next to a deadline phrase on the official page | Shows a live countdown and can be exported to a calendar |
| `is_estimated = true` | The programme's usual window, cross-checked against its official page | Shows **"Expected 4 Nov 2027"** with "Unconfirmed · check page" |
| No date | Nothing published that can be trusted | Says so, with a link to the official page |

Deadlines are never invented, and a blocked or unreadable source is surfaced as such rather than quietly dropped.

---

## Features

**Discovery**
- Browse 36 verified programmes across 23 countries, filtered by country, degree level, funding type, and "official sources only".
- Full-text search, ordered by the date that matters next.
- Homepage "Closing soonest" strip computed from live data.
- Detail pages with deadlines, required documents, eligibility criteria, and curated resources (essays, references, interviews).

**Tracking**
- Save scholarships to a tracker with interested / tracking / applied states.
- Urgency-coded countdowns for confirmed dates only.
- Requirement checklists (documents and eligibility) with per-item progress.
- "Matches your preferences" suggestions from your onboarding answers.

**Trust and export**
- Verification badges on every card and detail page, including when the source was last checked.
- One-click `.ics` calendar export — only confirmed, future deadlines are exported.
- A grounded chat assistant that answers from the catalogue and says "varies by track" when a single date would be a lie.

**Operations**
- Admin console: source health (including pages that block automated reads), listings missing requirements, review queue, and the questions the assistant could not answer.
- `scraper/verify_official.py` pipeline that verifies, dedupes, and ingests programmes from official pages.
- Setup and auth verification scripts that never print secrets.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS v4, Motion |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | SQLite locally, PostgreSQL (Supabase) in production |
| Auth | Supabase Auth, tokens verified server-side via JWKS |
| Data pipeline | Python + requests, official-source scraping and grading |

No UI component library: the interface is a custom clay surface system built on design tokens.

---

## Architecture

```
Next.js (server components + client islands)
   │  REST (JSON)
   ▼
FastAPI ──► SQLAlchemy ──► SQLite / PostgreSQL
   │
   ├─► Supabase Auth (JWKS verification, no shared secret)
   ├─► Official scholarship pages (verification pipeline)
   └─► .ics calendar export
```

---

## Local setup

**Requirements:** Node 20+, Python 3.11+, a Supabase project.

```bash
git clone https://github.com/Amna-Javed04/Bursarly.git
cd Bursarly
```

### Backend

```bash
python -m venv venv
venv/Scripts/activate            # Windows;  source venv/bin/activate elsewhere
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env     # then fill in the values below
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`backend/.env`

```ini
DATABASE_URL=sqlite:///./bursarly.db
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=          # optional: only used for admin checks
SUPABASE_JWT_SECRET=                # leave empty: tokens are verified via JWKS
ADMIN_API_KEY=change-me
CORS_ORIGINS=http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

`frontend/.env.local`

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Only the publishable/anon key belongs here. Never put the service-role key in a `NEXT_PUBLIC_*` variable.

### Supabase settings

- **Authentication → URL Configuration** — Site URL `http://localhost:3000`; redirect URLs `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/reset-password`.
- **Authentication → Sign In / Providers → Email** — keep "Confirm email" on, and configure custom SMTP if you need reliable delivery on the free tier.

### Verify the setup

```bash
cd backend
../venv/Scripts/python.exe ../scripts/check_setup.py    # env, DNS, auth health, JWKS
../venv/Scripts/python.exe ../scripts/verify_auth.py    # creates and deletes a test user
../venv/Scripts/python.exe -m unittest discover -s tests -v
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/scholarships` | Catalogue with `nearest_deadline` (confirmed) and `expected_deadline` |
| GET | `/scholarships/search?q=` | Name search, same fields |
| GET | `/scholarships/{id}` | Full detail: deadlines, documents, eligibility, resources |
| GET | `/scholarships/{id}/resources` | Curated help resources |
| GET | `/scholarships/{id}/calendar.ics` | Calendar export (confirmed dates only) |
| POST | `/chat` | Grounded assistant |
| GET/PUT | `/user-profile/me` | Preferences |
| GET/POST/PATCH/DELETE | `/user-scholarships…` | Tracker |
| PATCH | `/user-scholarships/{id}/requirements/{requirement_id}` | Checklist item |
| GET | `/admin/source-health` | Verification status, blocked sources, unmatched queries |
| GET/PATCH | `/admin/scholarships…` | Review queue |

---

## Data pipeline

```bash
cd scraper
../venv/Scripts/python.exe verify_official.py --all       # dedupe → add → verify
../venv/Scripts/python.exe verify_official.py --dry-run   # report only
```

A deadline is only marked confirmed when its date appears beside a deadline phrase on the provider's page. Documents are graded the same way. Pages behind bot protection stay visible but are labelled unreadable. `run_weekly_verification.ps1` wraps a full sweep for Task Scheduler.

---

## Deployment

Recommended split: **Vercel** for the web app, **Render** for the API, **Supabase** for Postgres and auth.

**Backend (Render)**
- Root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Environment: `DATABASE_URL` (Supabase Postgres pooler URL), `SUPABASE_URL`, `ADMIN_API_KEY`, `CORS_ORIGINS=https://your-app.vercel.app`.
- Do not rely on the bundled SQLite file: Render's filesystem is ephemeral. Tables are created automatically on first boot, so migrate the catalogue with a seed script before going live.

**Frontend (Vercel)**
- Root directory `frontend`; framework preset Next.js.
- Environment: `NEXT_PUBLIC_API_URL=https://your-api.onrender.com`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Update Supabase's Site URL and redirect URLs to the deployed domain.

---

## Project structure

```
backend/
  app/            FastAPI app: models, schemas, crud, auth, services (chatbot, calendar)
  tests/          Unit tests (matcher, calendar) + manual DB smoke check
frontend/
  app/            Routes: home, browse, search, scholarship/[id], dashboard, admin, auth, legal
  components/     Cards, badges, motion primitives, chat widget, navigation
  lib/            Typed API client, formatting and sorting helpers
scraper/          Verification pipeline, dedupe, ingestion, weekly runner
scripts/          Setup checker and end-to-end auth verifier
```

---

## Status and limitations

- 36 programmes, 23 countries, 232 documents, 161 eligibility criteria.
- 1 deadline is confirmed for the current cycle; 34 are labelled expected with their source noted; 1 programme (Mastercard Foundation) has no programme-wide date because partner universities set their own.
- 8 official pages block automated reads and are labelled accordingly.
- The assistant runs on a deterministic grounded engine; adding an LLM key enables richer phrasing, not different facts.

---

## License

Personal project by [Amna Javed](https://github.com/Amna-Javed04). Code available for reference; the scholarship data belongs to the respective providers.
