-- Migration: 20261111_idempotency_lease_fencing_v2.sql
-- Description:
-- 1. Atomic initial claims with INSERT ... ON CONFLICT to eliminate first-time claim race condition.
-- 2. Enforce active lease ownership (locked_until > now()) during completion and failure.
-- 3. Prevent duplicate journal entries / mutations on retries.

CREATE OR REPLACE FUNCTION public.claim_whatsapp_message_fenced(
    p_message_id TEXT,
    p_lease_seconds INTEGER DEFAULT 180
)
RETURNS TABLE (
    result TEXT,
    fence_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_token UUID := gen_random_uuid();
    v_status TEXT;
    v_locked_until TIMESTAMPTZ;
    v_current_token UUID;
BEGIN
    -- Atomic upsert attempt
    INSERT INTO public.whatsapp_processed_messages (
        id, status, attempts, locked_until, fence_token, processed_at
    ) VALUES (
        p_message_id, 'processing', 1, now() + (p_lease_seconds || ' seconds')::INTERVAL, v_new_token, now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- If insert succeeded, we claimed it on the very first try
    IF FOUND THEN
        RETURN QUERY SELECT 'claimed'::TEXT, v_new_token;
        RETURN;
    END IF;

    -- If conflict occurred, lock existing row and check lease/status
    SELECT status, locked_until, whatsapp_processed_messages.fence_token
    INTO v_status, v_locked_until, v_current_token
    FROM public.whatsapp_processed_messages
    WHERE id = p_message_id
    FOR UPDATE;

    -- If already completed, reject duplicate retry
    IF v_status = 'completed' THEN
        RETURN QUERY SELECT 'completed'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- If in flight and lease is still strictly active, reject concurrent attempt
    IF v_status = 'processing' AND v_locked_until > now() THEN
        RETURN QUERY SELECT 'in_flight'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Lease has expired or previous attempt failed: grant new lease with new fence token
    UPDATE public.whatsapp_processed_messages
    SET status = 'processing',
        attempts = attempts + 1,
        locked_until = now() + (p_lease_seconds || ' seconds')::INTERVAL,
        fence_token = v_new_token,
        error = NULL
    WHERE id = p_message_id;

    RETURN QUERY SELECT 'claimed'::TEXT, v_new_token;
    RETURN;
END;
$$;

-- Enforce active lease ownership on completion
CREATE OR REPLACE FUNCTION public.complete_whatsapp_message_fenced(
    p_message_id TEXT,
    p_fence_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    -- Must match fence token AND lease must NOT have expired
    UPDATE public.whatsapp_processed_messages
    SET status = 'completed',
        locked_until = NULL,
        error = NULL,
        processed_at = now()
    WHERE id = p_message_id 
      AND fence_token = p_fence_token
      AND locked_until > now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- Enforce active lease ownership on failure
CREATE OR REPLACE FUNCTION public.fail_whatsapp_message_fenced(
    p_message_id TEXT,
    p_fence_token UUID,
    p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.whatsapp_processed_messages
    SET status = 'failed',
        locked_until = NULL,
        error = p_error
    WHERE id = p_message_id 
      AND fence_token = p_fence_token
      AND locked_until > now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

NOTIFY pgrst, 'reload schema';
