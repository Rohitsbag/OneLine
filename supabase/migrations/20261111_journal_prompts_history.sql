-- Migration: 20261111_journal_prompts_history.sql
-- Description: Table to track daily reflection prompts sent to users on WhatsApp,
-- ensuring no repetition within a rolling 30-day window.

CREATE TABLE IF NOT EXISTS public.journal_prompts_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    category TEXT DEFAULT 'reflection',
    served_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup of a user's recent prompts
CREATE INDEX IF NOT EXISTS idx_prompts_history_user_date 
ON public.journal_prompts_history (user_id, served_at DESC);

-- Enable RLS
ALTER TABLE public.journal_prompts_history ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'journal_prompts_history' 
          AND policyname = 'Service role full access on journal_prompts_history'
    ) THEN
        CREATE POLICY "Service role full access on journal_prompts_history"
        ON public.journal_prompts_history
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
