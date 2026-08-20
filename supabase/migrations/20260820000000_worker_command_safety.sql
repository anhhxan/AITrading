-- PHASE 0 DATABASE SAFETY IMPLEMENTATION

-- 1. Thêm các cột còn thiếu vào bảng robot_commands
ALTER TABLE robot_commands 
ADD COLUMN IF NOT EXISTS payload JSONB,
ADD COLUMN IF NOT EXISTS worker_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

-- 2. Khởi tạo RPC claim_robot_commands (Dùng FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_robot_commands(p_worker_id VARCHAR, p_limit INT)
RETURNS SETOF robot_commands
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE robot_commands
    SET status = 'PROCESSING', 
        worker_id = p_worker_id, 
        attempt_count = attempt_count + 1,
        processed_at = NOW()
    WHERE id IN (
        SELECT id FROM robot_commands
        WHERE status = 'RECEIVED'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    RETURNING *;
END;
$$;

-- 3. Tạo Index để tối ưu hóa Polling
CREATE INDEX IF NOT EXISTS idx_robot_commands_polling 
ON robot_commands(status, created_at ASC);
