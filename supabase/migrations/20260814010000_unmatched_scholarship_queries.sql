-- Migration: Create unmatched_scholarship_queries table
-- Purpose: Log user queries for scholarships not present in Bursarly database to inform future data additions.

CREATE TABLE IF NOT EXISTS public.unmatched_scholarship_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved BOOLEAN NOT NULL DEFAULT false
);

-- Index for efficient querying by resolution status and recency
CREATE INDEX IF NOT EXISTS idx_unmatched_queries_resolved_asked 
ON public.unmatched_scholarship_queries (resolved, asked_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.unmatched_scholarship_queries ENABLE ROW LEVEL SECURITY;

-- Service role / admins can read and manage, users can insert
CREATE POLICY "Anyone can insert unmatched queries"
    ON public.unmatched_scholarship_queries
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view unmatched queries"
    ON public.unmatched_scholarship_queries
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@bursarly.com');
