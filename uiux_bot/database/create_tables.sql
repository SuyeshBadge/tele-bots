-- Create subscribers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscribers (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lessons (
    id SERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    quiz_question TEXT,
    quiz_options JSONB,
    correct_option_index INTEGER,
    explanation TEXT,
    option_explanations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    recent_themes JSONB DEFAULT '[]'::jsonb,
    recent_lessons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create health status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.health_status (
    id SERIAL PRIMARY KEY,
    start_time BIGINT NOT NULL,
    last_activity BIGINT NOT NULL,
    lessons_sent INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 