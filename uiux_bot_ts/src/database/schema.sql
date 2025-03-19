-- UI/UX Lesson Bot Database Schema

-- Subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
  lesson_count INTEGER NOT NULL DEFAULT 0,
  quiz_count INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

-- Health status table
CREATE TABLE IF NOT EXISTS health_status (
  id INTEGER PRIMARY KEY,
  last_check_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_healthy BOOLEAN NOT NULL,
  subscribers INTEGER NOT NULL,
  total_lessons_delivered INTEGER NOT NULL,
  total_quizzes INTEGER NOT NULL,
  startup_time TIMESTAMP WITH TIME ZONE NOT NULL,
  last_error TEXT,
  last_error_time TIMESTAMP WITH TIME ZONE,
  version TEXT NOT NULL
);

-- Lessons table for caching generated lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id TEXT PRIMARY KEY,
  theme TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vocabulary TEXT,
  has_vocabulary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quiz_question TEXT,
  quiz_options TEXT[],
  quiz_correct_index INTEGER,
  explanation TEXT,
  option_explanations TEXT[],
  image_url TEXT,
  example_link JSONB,
  video_query TEXT
);

-- User history table for tracking user interactions
CREATE TABLE IF NOT EXISTS user_history (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES subscribers(id),
  action_type TEXT NOT NULL,
  action_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add the quizzes table schema
CREATE TABLE IF NOT EXISTS quizzes (
  poll_id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  correct_option INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  theme TEXT,
  explanation TEXT,
  option_explanations TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscribers_last_activity ON subscribers(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_created_at ON user_history(created_at);
CREATE INDEX IF NOT EXISTS idx_lessons_theme ON lessons(theme);
CREATE INDEX IF NOT EXISTS idx_quizzes_expires_at ON quizzes (expires_at);

-- Create a function to update last_activity automatically
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update last_activity on subscriber update
CREATE TRIGGER update_subscriber_last_activity
BEFORE UPDATE ON subscribers
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();

-- Create a function to log user actions
CREATE OR REPLACE FUNCTION log_user_action(
  p_user_id BIGINT,
  p_action_type TEXT,
  p_action_data JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_history (user_id, action_type, action_data, created_at)
  VALUES (p_user_id, p_action_type, p_action_data, NOW());
  
  -- Update subscriber last_activity
  UPDATE subscribers
  SET last_activity = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Add a function for regular cleanup of expired quizzes
CREATE OR REPLACE FUNCTION cleanup_expired_quizzes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM quizzes 
  WHERE expires_at < now()
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create the lesson_delivery table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lesson_delivery (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    lesson_id TEXT NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lesson_delivery_user_id ON public.lesson_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_delivery_lesson_id ON public.lesson_delivery(lesson_id);

-- Create or update the health table with the correct schema
CREATE TABLE IF NOT EXISTS public.health (
    id SERIAL PRIMARY KEY,
    last_check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_healthy BOOLEAN DEFAULT TRUE,
    subscribers INTEGER DEFAULT 0,
    total_lessons_delivered INTEGER DEFAULT 0,
    total_quizzes INTEGER DEFAULT 0,
    startup_time TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    last_error_time TIMESTAMP WITH TIME ZONE,
    version TEXT,
    next_scheduled_lesson TIMESTAMP WITH TIME ZONE
);

-- Create table to track sent YouTube videos
CREATE TABLE IF NOT EXISTS public.sent_videos (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES subscribers(id),
    video_id TEXT NOT NULL,
    theme TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sent_videos_user_id ON public.sent_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_videos_video_id ON public.sent_videos(video_id); 