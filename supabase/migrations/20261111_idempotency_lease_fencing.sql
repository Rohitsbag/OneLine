-- Migration: 20261111_idempotency_lease_fencing.sql
-- Description: Add fence token (UUID) and extend lease RPCs to prevent race conditions during long-running tasks.

ALTER TABLE public.whatsapp_processed_messages
ADD COLUMN IF NOT EXISTS fence_token UUID DEFAULT gen_random_uuid();

-- Add snooze support to user_settings for reliable 1-hour snoozing
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- Drop prior functions to update signature
DROP FUNCTION IF EXISTS public.claim_whatsapp_message(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.complete_whatsapp_message(TEXT);
DROP FUNCTION IF EXISTS public.fail_whatsapp_message(TEXT, TEXT);

-- 1. Fenced Claim RPC: returns status and the generated lease fence_token
CREATE OR REPLACE FUNCTION public.claim_whatsapp_message_fenced(
    p_message_id TEXT,
    p_lease_seconds INTEGER DEFAULT 180 -- Increased to 3 minutes for heavy multimodal/audio tasks
)
RETURNS TABLE (
    result TEXT,
    fence_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_locked_until TIMESTAMPTZ;
    v_new_token UUID := gen_random_uuid();
BEGIN
    SELECT status, locked_until INTO v_status, v_locked_until
    FROM public.whatsapp_processed_messages
    WHERE id = p_message_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.whatsapp_processed_messages (
            id, status, attempts, locked_until, fence_token, processed_at
        ) VALUES (
            p_message_id, 'processing', 1, now() + (p_lease_seconds || ' seconds')::INTERVAL, v_new_token, now()
        );
        RETURN QUERY SELECT 'claimed'::TEXT, v_new_token;
        RETURN;
    END IF;

    IF v_status = 'completed' THEN
        RETURN QUERY SELECT 'completed'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- If in flight and lease is still valid, reject retry with 429/in_flight
    IF v_status = 'processing' AND v_locked_until > now() THEN
        RETURN QUERY SELECT 'in_flight'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Lease expired or previously failed: claim ownership with new fence token
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

-- 2. Fenced Complete RPC: completes ONLY if fence token matches current owner
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
    UPDATE public.whatsapp_processed_messages
    SET status = 'completed',
        locked_until = NULL,
        error = NULL,
        processed_at = now()
    WHERE id = p_message_id AND fence_token = p_fence_token;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- 3. Fenced Fail RPC: records error ONLY if fence token matches
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
    WHERE id = p_message_id AND fence_token = p_fence_token;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_whatsapp_message_fenced(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_message_fenced(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_whatsapp_message_fenced(TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
