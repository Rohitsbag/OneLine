-- ============================================================
-- API Access SQL Fixes - Run in Supabase SQL Editor
-- ============================================================

-- Fix 1: api_upsert_entry (ambiguous column reference)
DROP FUNCTION IF EXISTS api_upsert_entry(uuid, date, text);

CREATE OR REPLACE FUNCTION api_upsert_entry(
  p_user_id UUID,
  p_date DATE,
  p_content TEXT
)
RETURNS TABLE(
  entry_id UUID,
  entry_date DATE,
  entry_content TEXT,
  entry_updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
DECLARE
  v_content_size INT;
  v_result RECORD;
BEGIN
  v_content_size := octet_length(p_content);
  IF v_content_size > 102400 THEN
    RAISE EXCEPTION 'Content exceeds 100KB limit';
  END IF;

  INSERT INTO entries (user_id, date, content, updated_at)
  VALUES (p_user_id, p_date, p_content, now())
  ON CONFLICT (user_id, date)
  DO UPDATE SET content = EXCLUDED.content, updated_at = now()
  RETURNING id, entries.date, entries.content, entries.updated_at INTO v_result;
  
  entry_id := v_result.id;
  entry_date := v_result.date;
  entry_content := v_result.content;
  entry_updated_at := v_result.updated_at;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: api_search_journal (use ILIKE instead of strict trigram %)
DROP FUNCTION IF EXISTS api_search_journal(uuid, text, int);

CREATE OR REPLACE FUNCTION api_search_journal(
  p_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  entry_date DATE,
  entry_content TEXT,
  score REAL
) SECURITY DEFINER AS $$
BEGIN
  IF p_limit > 10 THEN
    p_limit := 10;
  END IF;

  RETURN QUERY
  SELECT 
    e.date AS entry_date, 
    e.content AS entry_content, 
    similarity(e.content, p_query) AS score
  FROM entries e
  WHERE e.user_id = p_user_id 
    AND e.content ILIKE '%' || p_query || '%'
  ORDER BY score DESC, e.date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';

-- Done! Now redeploy Edge Functions:
-- supabase functions deploy api-gateway --no-verify-jwt
-- supabase functions deploy mcp-server --no-verify-jwt
