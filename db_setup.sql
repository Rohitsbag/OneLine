-- 1. Reset: Drop the broken table AND dependents (views)
DROP TABLE IF EXISTS entries CASCADE;

-- 2. Recreate: Correct Schema with ALL columns
CREATE TABLE entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  content text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Security: Enable RLS
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- 4. Permissions: Allow users full access to their own data
CREATE POLICY "Users can manage own entries" 
ON entries 
FOR ALL 
USING (auth.uid() = user_id);

-- 5. Refresh: Force API to recognize changes
NOTIFY pgrst, 'reload config';

-- 6. Verification: Check if table and columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'entries';
