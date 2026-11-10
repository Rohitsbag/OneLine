-- Migration: WhatsApp Journaling Integration, Settings, Reminders & Deduplication
-- Applied: 2026-11-10

-- 1. Extend user_settings table with WhatsApp, timezone, reminder and pending action state
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS whatsapp_pair_code TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_pair_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS whatsapp_auto_transcribe BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS last_reminded_date DATE,
ADD COLUMN IF NOT EXISTS whatsapp_pending_action TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_pending_expires_at TIMESTAMPTZ;

-- 2. Lightweight deduplication table to guarantee idempotency on Meta webhook retries
CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
    id TEXT PRIMARY KEY, -- WhatsApp message_id (e.g. wamid.HBgM...)
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for auto-cleanup or quick lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_processed_at 
ON public.whatsapp_processed_messages(processed_at);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access to deduplication table
DROP POLICY IF EXISTS "Service role access on whatsapp_processed_messages" ON public.whatsapp_processed_messages;
CREATE POLICY "Service role access on whatsapp_processed_messages" 
ON public.whatsapp_processed_messages 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
