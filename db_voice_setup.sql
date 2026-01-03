-- Add audio_url column to entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entries' AND column_name = 'audio_url') THEN
        ALTER TABLE entries ADD COLUMN audio_url text;
    END IF;
END $$;
