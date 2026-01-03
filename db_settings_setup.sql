-- 1. Create table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  ai_enabled boolean DEFAULT true,
  voice_enabled boolean DEFAULT true,
  theme text DEFAULT 'dark',
  accent_color text DEFAULT 'bg-white',
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- View own settings
CREATE POLICY "Users can view own settings" 
ON user_settings FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Update own settings
CREATE POLICY "Users can update own settings" 
ON user_settings FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Insert own settings
CREATE POLICY "Users can insert own settings" 
ON user_settings FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 4. Trigger to create settings on signup (Optional but good UX)
--    We will handle "if missing" in frontend too, but this helps.
CREATE OR REPLACE FUNCTION public.handle_new_user_settings() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (if you have permission to add triggers there, otherwise frontend handles creation)
-- Often simpler to just UPSERT from frontend on first load if missing.
-- We will skip the trigger complexity for now and handle "missing row" in frontend logic purely.

-- 5. Notify to refresh schema cache
-- 5. Migration for existing tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'accent_color') THEN
        ALTER TABLE user_settings ADD COLUMN accent_color text DEFAULT 'bg-white';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
