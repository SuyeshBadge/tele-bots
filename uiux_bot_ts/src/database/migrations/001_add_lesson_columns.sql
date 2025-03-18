-- Migration: Add missing columns to lessons table
-- Description: Adds vocabulary, has_vocabulary, example_link, and video_query columns to the lessons table

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add vocabulary column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'vocabulary'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN vocabulary TEXT;
    END IF;

    -- Add has_vocabulary column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'has_vocabulary'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN has_vocabulary BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add example_link column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'example_link'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN example_link JSONB;
    END IF;

    -- Add video_query column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'video_query'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN video_query TEXT;
    END IF;
END $$; 