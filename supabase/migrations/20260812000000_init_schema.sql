-- Enable UUID generation extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (mimicking/referencing Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- Stored in auth.users, keeping here as nullable placeholder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User Profile Table
CREATE TABLE public.user_profile (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    degree_level VARCHAR(100),
    countries_of_interest VARCHAR(100)[],
    field_of_study VARCHAR(255),
    needs_full_funding BOOLEAN DEFAULT FALSE NOT NULL
);

-- 3. Scholarships Table
CREATE TABLE public.scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    degree_level VARCHAR(100) NOT NULL,
    funding_type VARCHAR(100) NOT NULL,
    official_url VARCHAR(512),
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending_review' NOT NULL CHECK (status IN ('pending_review', 'approved', 'needs_fix')),
    source_type VARCHAR(50) DEFAULT 'manual' NOT NULL CHECK (source_type IN ('manual', 'scraped'))
);

-- 4. Scholarship Deadlines Table
CREATE TABLE public.scholarship_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
    deadline_date DATE NOT NULL,
    cycle_year INTEGER NOT NULL,
    deadline_type VARCHAR(100) NOT NULL
);

-- 5. Scholarship Documents Table
CREATE TABLE public.scholarship_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    is_required BOOLEAN DEFAULT TRUE NOT NULL
);

-- 6. Scholarship Eligibility Table
CREATE TABLE public.scholarship_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
    criteria_text TEXT NOT NULL
);

-- 7. Resources Table
CREATE TABLE public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
    help_category VARCHAR(100) NOT NULL CHECK (help_category IN ('essay_help', 'recommendation_letter', 'application_process', 'interview_prep')),
    resource_type VARCHAR(100) NOT NULL CHECK (resource_type IN ('youtube_video', 'professional_service', 'institute', 'article')),
    title VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    is_free BOOLEAN DEFAULT TRUE NOT NULL
);

-- 8. User Scholarships Table (Tracker)
CREATE TABLE public.user_scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) DEFAULT 'interested' NOT NULL CHECK (status IN ('interested', 'tracking', 'applied')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_scholarship UNIQUE (user_id, scholarship_id)
);

-- 9. Reminder Log Table
CREATE TABLE public.reminder_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_scholarship_id UUID REFERENCES public.user_scholarships(id) ON DELETE CASCADE NOT NULL,
    reminder_type VARCHAR(100) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for frequently-queried fields
CREATE INDEX idx_scholarships_country ON public.scholarships(country);
CREATE INDEX idx_scholarships_status ON public.scholarships(status);

CREATE INDEX idx_scholarship_deadlines_scholarship_id ON public.scholarship_deadlines(scholarship_id);
CREATE INDEX idx_scholarship_deadlines_date ON public.scholarship_deadlines(deadline_date);

CREATE INDEX idx_scholarship_documents_scholarship_id ON public.scholarship_documents(scholarship_id);
CREATE INDEX idx_scholarship_eligibility_scholarship_id ON public.scholarship_eligibility(scholarship_id);

CREATE INDEX idx_resources_scholarship_id ON public.resources(scholarship_id);
CREATE INDEX idx_resources_category ON public.resources(help_category);

CREATE INDEX idx_user_scholarships_user_id ON public.user_scholarships(user_id);
CREATE INDEX idx_user_scholarships_scholarship_id ON public.user_scholarships(scholarship_id);
CREATE INDEX idx_reminder_log_user_scholarship_id ON public.reminder_log(user_scholarship_id);

-- Enable Row Level Security (RLS) on all tables holding user data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables to prevent modifications except by authorized roles
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Define Policies

-- 1. Users table policies
CREATE POLICY "Users can only read/write their own user record" ON public.users
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. User Profile table policies
CREATE POLICY "Users can only read/write their own profile" ON public.user_profile
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. User Scholarships (Tracker) table policies
CREATE POLICY "Users can only read/write their own tracked scholarships" ON public.user_scholarships
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Reminder Log table policies
CREATE POLICY "Users can only read their own reminder logs" ON public.reminder_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_scholarships
            WHERE public.user_scholarships.id = public.reminder_log.user_scholarship_id
            AND public.user_scholarships.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only insert their own reminder logs" ON public.reminder_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_scholarships
            WHERE public.user_scholarships.id = public.reminder_log.user_scholarship_id
            AND public.user_scholarships.user_id = auth.uid()
        )
    );

-- 5. Public read access to approved scholarships and their details
CREATE POLICY "Anyone can view approved scholarships" ON public.scholarships
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Anyone can view deadlines for approved scholarships" ON public.scholarship_deadlines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.scholarships
            WHERE public.scholarships.id = public.scholarship_deadlines.scholarship_id
            AND public.scholarships.status = 'approved'
        )
    );

CREATE POLICY "Anyone can view documents for approved scholarships" ON public.scholarship_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.scholarships
            WHERE public.scholarships.id = public.scholarship_documents.scholarship_id
            AND public.scholarships.status = 'approved'
        )
    );

CREATE POLICY "Anyone can view eligibility for approved scholarships" ON public.scholarship_eligibility
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.scholarships
            WHERE public.scholarships.id = public.scholarship_eligibility.scholarship_id
            AND public.scholarships.status = 'approved'
        )
    );

CREATE POLICY "Anyone can view resources for approved scholarships" ON public.resources
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.scholarships
            WHERE public.scholarships.id = public.resources.scholarship_id
            AND public.scholarships.status = 'approved'
        )
    );
