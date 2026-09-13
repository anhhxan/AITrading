-- Migration: 20260914000000_atomic_paper_close.sql
-- Description: Create atomic_paper_close RPC for paper trading 100% ACID close

CREATE OR REPLACE FUNCTION atomic_paper_close(
    p_robot_id UUID,
    p_exit_price DECIMAL,
    p_close_reason VARCHAR,
    p_correlation_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pos_id UUID;
    v_side VARCHAR;
    v_quantity DECIMAL;
    v_entry_price DECIMAL;
    v_symbol VARCHAR;
    v_realized_pnl DECIMAL;
    v_result JSONB;
BEGIN
    -- 1 & 2 & 3. Xác định đúng active position và Lock row (FOR UPDATE)
    SELECT id, side, quantity, entry_price, symbol
    INTO v_pos_id, v_side, v_quantity, v_entry_price, v_symbol
    FROM active_positions
    WHERE robot_id = p_robot_id
    FOR UPDATE SKIP LOCKED;

    IF v_pos_id IS NULL THEN
        -- Không tìm thấy position nào hoặc bị lock bởi tx khác
        RETURN jsonb_build_object('success', false, 'error', 'ACTIVE_POSITION_NOT_FOUND_OR_LOCKED');
    END IF;

    -- Compute PnL
    IF v_side = 'LONG' THEN
        v_realized_pnl := (p_exit_price - v_entry_price) * v_quantity;
    ELSIF v_side = 'SHORT' THEN
        v_realized_pnl := (v_entry_price - p_exit_price) * v_quantity;
    ELSE
        -- Fallback
        v_realized_pnl := 0;
    END IF;

    -- 4. INSERT trade_history
    -- Dùng schema đúng: robot_id, side, entry_price, exit_price, size, realized_pnl, fee, slippage, duration_seconds, close_reason, symbol, correlation_id
    INSERT INTO trade_history (
        robot_id, side, size, entry_price, exit_price, 
        realized_pnl, fee, slippage, duration_seconds, 
        close_reason, symbol, correlation_id
    ) VALUES (
        p_robot_id, v_side::position_side, v_quantity, v_entry_price, p_exit_price,
        v_realized_pnl, 0, 0, 0,
        p_close_reason::trade_reason, v_symbol, p_correlation_id
    );

    -- 5. DELETE đúng position đã close
    DELETE FROM active_positions WHERE id = v_pos_id;

    -- 6. UPDATE robots.paper_balance
    UPDATE robots 
    SET paper_balance = paper_balance + v_realized_pnl 
    WHERE id = p_robot_id;

    -- 7 & 8. Nếu fail Postgres tự rollback toàn bộ tx.
    v_result := jsonb_build_object(
        'success', true, 
        'realized_pnl', v_realized_pnl,
        'entry_price', v_entry_price,
        'quantity', v_quantity,
        'side', v_side,
        'symbol', v_symbol
    );
    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Bắt mọi lỗi và ném ra, đảm bảo transaction bị huỷ bỏ (Rollback).
    RAISE EXCEPTION 'Atomic Paper Close failed: %', SQLERRM;
END;
$$;
