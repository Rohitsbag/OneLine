-- Migration: 20261111_whatsapp_idempotency_state_machine.sql
-- Description: Implement atomic idempotency state machine with processing leases and attempt counters.
-- Preserves existing historical records by marking them as 'completed'.

-- 1. Extend public.whatsapp_processed_messages with state machine columns
ALTER TABLE public.whatsapp_processed_messages
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error TEXT;

-- 2. Ensure all pre-existing records are marked 'completed'
UPDATE public.whatsapp_processed_messages
SET status = 'completed'
WHERE status IS NULL OR status = '';

-- 3. Create index on status and lease expiration for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_locked
ON public.whatsapp_processed_messages(status, locked_until);

-- 4. Atomic claim RPC: Claim message for processing with a 60-second lease
-- Returns:
--   'claimed'   -> Caller successfully claimed the message and owns the lock
--   'completed' -> Message was already processed successfully, discard retry
--   'in_flight' -> Message is currently being processed by another active worker under lease
CREATE OR REPLACE FUNCTION public.claim_whatsapp_message(
    p_message_id TEXT,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_locked_until TIMESTAMPTZ;
BEGIN
    -- Check if record exists
    SELECT status, locked_until
    INTO v_current_status, v_locked_until
    FROM public.whatsapp_processed_messages
    WHERE id = p_message_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Brand new message: atomically insert as processing with lease
        INSERT INTO public.whatsapp_processed_messages (
            id,
            status,
            attempts,
            locked_until,
            processed_at
        ) VALUES (
            p_message_id,
            'processing',
            1,
            now() + (p_lease_seconds || ' seconds')::INTERVAL,
            now()
        );
        RETURN 'claimed';
    END IF;

    -- If already completed successfully, reject duplicate
    IF v_current_status = 'completed' THEN
        RETURN 'completed';
    END IF;

    -- If currently processing and lease has NOT expired, another worker owns it
    IF v_current_status = 'processing' AND v_locked_until > now() THEN
        RETURN 'in_flight';
    END IF;

    -- Either status is 'failed' OR lease has expired ('processing' with locked_until <= now())
    -- Reclaim lock atomically, increment attempts, and update lease
    UPDATE public.whatsapp_processed_messages
    SET status = 'processing',
        attempts = attempts + 1,
        locked_until = now() + (p_lease_seconds || ' seconds')::INTERVAL,
        error = NULL
    WHERE id = p_message_id;

    RETURN 'claimed';
END;
$$;

-- 5. Atomic complete RPC
CREATE OR REPLACE FUNCTION public.complete_whatsapp_message(
    p_message_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.whatsapp_processed_messages
    SET status = 'completed',
        locked_until = NULL,
        error = NULL,
        processed_at = now()
    WHERE id = p_message_id;
END;
$$;

-- 6. Atomic fail RPC (records error and releases lock for immediate retry)
CREATE OR REPLACE FUNCTION public.fail_whatsapp_message(
    p_message_id TEXT,
    p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.whatsapp_processed_messages
    SET status = 'failed',
        locked_until = NULL,
        error = p_error
    WHERE id = p_message_id;
END;
$$;

-- 7. Grant execution to service_role and authenticated/anon if needed
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_message(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_message(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_whatsapp_message(TEXT, TEXT) TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
