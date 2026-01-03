-- 1. Schema Update: Add image_url to entries if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entries' AND column_name = 'image_url') THEN
        ALTER TABLE entries ADD COLUMN image_url text;
    END IF;
END $$;

-- 2. Storage Setup: Create bucket 'journal_images'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('journal_images', 'journal_images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- We do NOT enable RLS on storage.objects as it is usually enabled by default and requires superuser permissions.

-- Drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Create policies
-- Allow users to upload (INSERT) their own files
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to view (SELECT) their own images
CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to update/delete their own images
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';
