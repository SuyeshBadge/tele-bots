-- Migration: Add batch tracking table
-- Description: Creates a table to track batch jobs for lesson generation

-- Create batch_jobs table for tracking batch processing
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id TEXT NOT NULL,
  anthropic_batch_id TEXT NOT NULL, 
  pool_type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'created', 'processing', 'completed', 'failed'
  lesson_count INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  results_url TEXT NULL,
  CONSTRAINT batch_jobs_pkey PRIMARY KEY (id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_batch_jobs_pool_type ON public.batch_jobs USING btree (pool_type);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_anthropic_batch_id ON public.batch_jobs USING btree (anthropic_batch_id);

-- Add a comment to explain the table purpose
COMMENT ON TABLE public.batch_jobs IS 'Tracks batch jobs for generating lessons'; 