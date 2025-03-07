-- UI/UX Bot Database Schema
-- Run this in your Supabase SQL Editor to set up the necessary tables

-- Enable Row-Level Security (RLS)
ALTER DATABASE postgres SET "anon".enable_rls TO on;

-- Drop existing tables if they exist (for clean re-creation)
DROP TABLE IF EXISTS subscribers CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS user_history CASCADE;
DROP TABLE IF EXISTS health_status CASCADE;

-- Create subscribers table
CREATE TABLE subscribers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_subscribers_user_id ON subscribers(user_id);

-- Create lessons table
CREATE TABLE lessons (
    id BIGSERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Array of bullet points
    quiz_question TEXT NOT NULL,
    quiz_options JSONB NOT NULL, -- Array of options
    correct_option_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    option_explanations JSONB NOT NULL, -- Array of explanations
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on theme for faster lookups
CREATE INDEX idx_lessons_theme ON lessons(theme);
CREATE INDEX idx_lessons_created_at ON lessons(created_at DESC);

-- Create user_history table
CREATE TABLE user_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE, -- User ID as text to support both Telegram and channel IDs
    recent_themes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of recently sent themes
    recent_lessons JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of recently sent lesson summaries
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_history_user_id ON user_history(user_id);

-- Create health_status table (singleton)
CREATE TABLE health_status (
    id SMALLSERIAL PRIMARY KEY, -- Only one row expected
    start_time BIGINT NOT NULL, -- Unix timestamp
    last_activity BIGINT NOT NULL, -- Unix timestamp
    lessons_sent INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT one_row_only CHECK (id = 1) -- Ensure only one row can exist
);

-- Enable Row-Level Security (RLS)
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- For now, allow all operations since we're using service role key
CREATE POLICY "Allow all operations on subscribers" ON subscribers FOR ALL USING (true);
CREATE POLICY "Allow all operations on lessons" ON lessons FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_history" ON user_history FOR ALL USING (true);
CREATE POLICY "Allow all operations on health_status" ON health_status FOR ALL USING (true); 