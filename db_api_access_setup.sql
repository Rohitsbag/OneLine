-- ============================================================
-- MCP Support & API Access - Database Schema
-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enable pg_trgm extension for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. API Keys Table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_id VARCHAR(32) NOT NULL UNIQUE,  -- 16-byte hex, public identifier
  key_hash BYTEA NOT NULL,              -- Argon2id hash of secret
  scopes JSONB DEFAULT '["read:entries"]'::jsonb,
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  expires_at TIMESTAMPTZ,               -- NULL = never expires
  revoked_at TIMESTAMPTZ,               -- NULL = active
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON user_api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON user_api_keys(key_id);

-- RLS: Users can only see their own keys
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own API keys"
ON user_api_keys FOR ALL
USING (auth.uid() = user_id);

-- ============================================================
-- 3. Audit Logs Table (Append-Only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  key_id VARCHAR(32),
  ip_address INET,
  tool_name VARCHAR(100),
  method VARCHAR(10),
  path VARCHAR(500),
  status VARCHAR(20) NOT NULL,          -- success, failure, rate_limited
  status_code INT,
  input_hash TEXT,                       -- SHA-256 of sanitized input
  cost_tokens INT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);

-- RLS: Users can only read their own logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
ON audit_logs FOR SELECT
USING (auth.uid() = user_id);

-- ============================================================
-- 4. Trigram Index for Journal Search
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_entries_content_trgm 
ON entries USING gin(content gin_trgm_ops);

-- ============================================================
-- 5. RPC: Validate API Key (SECURITY DEFINER)
-- ============================================================
-- Returns key data for Edge Function to verify hash
CREATE OR REPLACE FUNCTION api_get_key_by_id(p_key_id VARCHAR)
RETURNS TABLE(
  user_id UUID,
  key_hash BYTEA,
  scopes JSONB,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
  SELECT user_id, key_hash, scopes, revoked_at, expires_at
  FROM user_api_keys
  WHERE key_id = p_key_id;
$$ LANGUAGE sql;

-- ============================================================
-- 6. RPC: Get Entries for API (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION api_get_entries(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 30
)
RETURNS TABLE(
  id UUID,
  date DATE,
  content TEXT,
  updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
BEGIN
  -- Enforce max 90-day range
  IF p_end_date - p_start_date > 90 THEN
    RAISE EXCEPTION 'Date range cannot exceed 90 days';
  END IF;
  
  -- Enforce max limit
  IF p_limit > 100 THEN
    p_limit := 100;
  END IF;

  RETURN QUERY
  SELECT e.id, e.date, e.content, e.updated_at
  FROM entries e
  WHERE e.user_id = p_user_id
    AND e.date BETWEEN p_start_date AND p_end_date
  ORDER BY e.date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. RPC: Upsert Entry for API (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION api_upsert_entry(
  p_user_id UUID,
  p_date DATE,
  p_content TEXT
)
RETURNS TABLE(
  id UUID,
  date DATE,
  content TEXT,
  updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
DECLARE
  v_content_size INT;
BEGIN
  -- Enforce max 100KB content
  v_content_size := octet_length(p_content);
  IF v_content_size > 102400 THEN
    RAISE EXCEPTION 'Content exceeds 100KB limit';
  END IF;

  RETURN QUERY
  INSERT INTO entries (user_id, date, content, updated_at)
  VALUES (p_user_id, p_date, p_content, now())
  ON CONFLICT (user_id, date)
  DO UPDATE SET content = EXCLUDED.content, updated_at = now()
  RETURNING entries.id, entries.date, entries.content, entries.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. RPC: Search Journal for API (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION api_search_journal(
  p_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  date DATE,
  content TEXT,
  score REAL
) SECURITY DEFINER AS $$
BEGIN
  -- Enforce max 10 results
  IF p_limit > 10 THEN
    p_limit := 10;
  END IF;

  RETURN QUERY
  SELECT e.date, e.content, similarity(e.content, p_query) AS score
  FROM entries e
  WHERE e.user_id = p_user_id 
    AND e.content % p_query
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. RPC: Update Last Used (for async update)
-- ============================================================
CREATE OR REPLACE FUNCTION api_update_key_last_used(
  p_key_id VARCHAR,
  p_ip_address INET
)
RETURNS VOID SECURITY DEFINER AS $$
  UPDATE user_api_keys
  SET last_used_at = now(), last_used_ip = p_ip_address
  WHERE key_id = p_key_id;
$$ LANGUAGE sql;

-- ============================================================
-- 10. RPC: Insert Audit Log (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION api_insert_audit_log(
  p_request_id UUID,
  p_user_id UUID,
  p_key_id VARCHAR,
  p_ip_address INET,
  p_tool_name VARCHAR,
  p_method VARCHAR,
  p_path VARCHAR,
  p_status VARCHAR,
  p_status_code INT,
  p_input_hash TEXT,
  p_cost_tokens INT,
  p_duration_ms INT
)
RETURNS UUID SECURITY DEFINER AS $$
  INSERT INTO audit_logs (
    request_id, user_id, key_id, ip_address, tool_name,
    method, path, status, status_code, input_hash,
    cost_tokens, duration_ms
  ) VALUES (
    p_request_id, p_user_id, p_key_id, p_ip_address, p_tool_name,
    p_method, p_path, p_status, p_status_code, p_input_hash,
    p_cost_tokens, p_duration_ms
  )
  RETURNING id;
$$ LANGUAGE sql;

-- ============================================================
-- 11. Refresh PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload config';
