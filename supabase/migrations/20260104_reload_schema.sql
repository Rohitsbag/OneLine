-- Reload the PostgREST schema cache
-- Run this to fix the "406 Not Acceptable" error after adding columns
NOTIFY pgrst, 'reload schema';
