-- 1. Schema Update: Add image_url to entries (Essential)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entries' AND column_name = 'image_url') THEN
        ALTER TABLE entries ADD COLUMN image_url text;
    END IF;
END $$;

-- 2. Storage Policies for 'journal-media-private'
-- Since you manually created the bucket 'journal-media-private', we just need to allow you to upload to it.

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Create policies targeting the CORRECT bucket: 'journal-media-private'

-- Allow users to upload (INSERT)
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'journal-media-private' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to view (SELECT) - Even for private buckets, RLS is needed for the owner to download/sign URLs
CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'journal-media-private' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to update/delete
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'journal-media-private' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'journal-media-private' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
