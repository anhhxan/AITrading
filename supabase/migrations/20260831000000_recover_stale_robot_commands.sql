-- PHASE 3.13H - PROCESSING CRASH RECOVERY
CREATE OR REPLACE FUNCTION recover_stale_robot_commands()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE robot_commands
    SET status = 'RECEIVED',
        attempt_count = attempt_count + 1,
        processed_at = NOW()
    WHERE id IN (
        SELECT id FROM robot_commands
        WHERE status = 'PROCESSING'
          AND processed_at < NOW() - INTERVAL '5 minutes'
        FOR UPDATE SKIP LOCKED
        LIMIT 100
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
