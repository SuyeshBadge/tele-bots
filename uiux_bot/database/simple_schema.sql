-- Create subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
    id BIGSERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    quiz_question TEXT NOT NULL,
    quiz_options JSONB NOT NULL,
    correct_option_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    option_explanations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_history table
CREATE TABLE IF NOT EXISTS user_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    recent_themes JSONB NOT NULL DEFAULT '[]'::jsonb,
    recent_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create health_status table
CREATE TABLE IF NOT EXISTS health_status (
    id SMALLSERIAL PRIMARY KEY,
    start_time BIGINT NOT NULL,
    last_activity BIGINT NOT NULL,
    lessons_sent INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
); 