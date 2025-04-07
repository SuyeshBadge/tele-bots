-- Migration: Add pool management support
-- Description: Adds pool_type, is_used, used_at, and batch_id columns to the lessons table
-- and creates the lesson_pool_stats table for tracking pools

-- Add new columns to lessons table if they don't exist
DO $$ 
BEGIN
    -- Add pool_type column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'pool_type'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN pool_type TEXT DEFAULT 'on-demand'::TEXT;
    END IF;

    -- Add is_used column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'is_used'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN is_used BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add used_at column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'used_at'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add batch_id column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' 
        AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE public.lessons ADD COLUMN batch_id TEXT;
    END IF;
END $$;

-- Create lesson_pool_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lesson_pool_stats (
  id SERIAL NOT NULL,
  pool_type TEXT NOT NULL,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  available_lessons INTEGER NOT NULL DEFAULT 0,
  last_generated TIMESTAMP WITH TIME ZONE,
  batch_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT lesson_pool_stats_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_pool_stats_pool_type_key UNIQUE (pool_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lessons_pool_type ON public.lessons USING btree (pool_type);
CREATE INDEX IF NOT EXISTS idx_lessons_is_used ON public.lessons USING btree (is_used);
CREATE INDEX IF NOT EXISTS idx_lessons_batch_id ON public.lessons USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_lesson_pool_stats_pool_type ON public.lesson_pool_stats USING btree (pool_type); 