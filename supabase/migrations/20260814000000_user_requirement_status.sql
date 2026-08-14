-- Migration: User Requirement Status Table & RLS Policies

CREATE TABLE IF NOT EXISTS public.user_requirement_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_scholarship_id UUID REFERENCES public.user_scholarships(id) ON DELETE CASCADE NOT NULL,
    requirement_type VARCHAR(50) NOT NULL CHECK (requirement_type IN ('document', 'eligibility')),
    requirement_id UUID NOT NULL,
    is_fulfilled BOOLEAN DEFAULT FALSE NOT NULL,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_requirement UNIQUE (user_scholarship_id, requirement_type, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_req_status_user_scholarship_id ON public.user_requirement_status(user_scholarship_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_requirement_status ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read/write rows tied to their own user_scholarships
CREATE POLICY "Users can only read/write their own requirement status" ON public.user_requirement_status
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_scholarships
            WHERE public.user_scholarships.id = public.user_requirement_status.user_scholarship_id
            AND public.user_scholarships.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_scholarships
            WHERE public.user_scholarships.id = public.user_requirement_status.user_scholarship_id
            AND public.user_scholarships.user_id = auth.uid()
        )
    );
