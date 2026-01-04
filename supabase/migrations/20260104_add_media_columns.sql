-- Migration: Add media columns to entries table
-- Reason: User reported "column entries.image_url does not exist" logs

ALTER TABLE public.entries 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Verify RLS policies might need checking, but standard policies usually cover all columns.
