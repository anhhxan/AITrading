-- ==========================================
-- AI TRADING PLATFORM V1.1 (ENTERPRISE)
-- SUPABASE POSTGRESQL SCHEMA
-- ==========================================

-- 1. TRADING ROBOTS (Digital Employees)
CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'CREATED', -- CREATED, CONFIGURED, READY, RUNNING, PAUSED, STOPPED, ERROR, ARCHIVED
    current_state VARCHAR(50) DEFAULT 'IDLE', -- IDLE, SIGNAL_DETECTED, WAIT_RETRACEMENT, READY_TO_ENTER
    current_state_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    active_config_version INTEGER DEFAULT 1,
    timeframe VARCHAR(10) NOT NULL, -- e.g., 3H
    signal_source VARCHAR(50) NOT NULL, -- e.g., Binance, TradingView Reference
    trading_view_symbol VARCHAR(50) NOT NULL, -- e.g., BTCUSDT
    execution_symbol VARCHAR(50) NOT NULL, -- e.g., BTCUSDT
    provider VARCHAR(50) NOT NULL, -- e.g., Binance Futures, MT5
    trading_account_id UUID, -- Reference to a trading_accounts table (not defined here for brevity)
    
    -- Session
    trading_session VARCHAR(50) DEFAULT '24/7',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.A. ROBOT CONFIGS (Configuration Versioning)
CREATE TABLE robot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- ACTIVE, PENDING, ARCHIVED
    indicator_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    strategy_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    entry_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    exit_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    applied_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(robot_id, version)
);

CREATE UNIQUE INDEX idx_unique_active_config 
ON robot_configs(robot_id) 
WHERE status = 'ACTIVE';

-- 1.C. RPC for Atomic Config Apply
CREATE OR REPLACE FUNCTION apply_robot_config(
  p_robot_id UUID,
  p_version INTEGER,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- 1. Archive current active
  UPDATE robot_configs 
  SET status = 'ARCHIVED' 
  WHERE robot_id = p_robot_id AND status = 'ACTIVE';
  
  -- 2. Activate pending
  UPDATE robot_configs 
  SET status = 'ACTIVE', applied_at = timezone('utc'::text, now()), applied_by = p_user_id 
  WHERE robot_id = p_robot_id AND version = p_version;
  
  -- 3. Update active_config_version on robot
  UPDATE robots 
  SET active_config_version = p_version 
  WHERE id = p_robot_id;
END;
$$ LANGUAGE plpgsql;

-- 1.B. ROBOT COMMANDS (Serverless Idempotency)
CREATE TABLE robot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id UUID UNIQUE NOT NULL,
    robot_id UUID NOT NULL REFERENCES robots(id),
    user_id UUID NOT NULL,
    command_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'RECEIVED',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 1.D. AUDIT LOGS (Persistent Audit Trail)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    robot_id UUID NOT NULL REFERENCES robots(id),
    command_id UUID NOT NULL,
    command_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    previous_state VARCHAR(50),
    requested_state VARCHAR(50),
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 1.E. RPC for Atomic Archive
CREATE OR REPLACE FUNCTION archive_robot(
  p_robot_id UUID,
  p_user_id UUID,
  p_command_id UUID,
  p_correlation_id VARCHAR(100)
)
RETURNS JSONB AS $$
DECLARE
  v_current_state VARCHAR(50);
  v_status VARCHAR(50);
BEGIN
  -- Lock the row for update to prevent concurrent modification
  SELECT current_state, status INTO v_current_state, v_status
  FROM robots
  WHERE id = p_robot_id
  FOR UPDATE;
  
  IF v_current_state IN ('POSITION_OPEN', 'EXECUTION_PENDING', 'EXIT_PENDING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive robot in active execution state: ' || v_current_state);
  END IF;
  
  IF v_status = 'ARCHIVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Robot is already archived');
  END IF;
  
  UPDATE robots SET status = 'ARCHIVED', updated_at = now() WHERE id = p_robot_id;
  
  -- Record Audit Log
  INSERT INTO audit_logs (user_id, robot_id, command_id, command_type, correlation_id, previous_state, requested_state, result)
  VALUES (p_user_id, p_robot_id, p_command_id, 'ARCHIVE', p_correlation_id, v_status, 'ARCHIVED', jsonb_build_object('success', true));
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 2. ROBOT SNAPSHOTS (Audit & AI Optimization)
CREATE TABLE robot_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    strategy_version VARCHAR(50) NOT NULL,
    
    indicator_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., Band 1,2,3,4,5, RSI value
    risk_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., Calculated Position Size, Leverage
    entry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., Entry Price, Zone, Timeout state
    exit_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., Target TP/SL at entry time
    position_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., Current Position Sync from Binance
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TRADE HISTORY
CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    
    action VARCHAR(20) NOT NULL, -- BUY, SELL, CLOSE
    side VARCHAR(10) NOT NULL, -- LONG, SHORT
    amount DECIMAL NOT NULL,
    entry_price DECIMAL,
    exit_price DECIMAL,
    
    pnl DECIMAL,
    fee DECIMAL,
    funding DECIMAL,
    slippage DECIMAL,
    
    reason VARCHAR(255), -- e.g., Strategy Exit, ATR TP, Timeout
    trade_snapshot_id UUID REFERENCES robot_snapshots(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SEGREGATED LOGS
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID REFERENCES robots(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- SYSTEM, TRADING, EXECUTION, RISK, AUDIT
    level VARCHAR(20) NOT NULL DEFAULT 'INFO', -- INFO, WARN, ERROR, DEBUG
    message TEXT NOT NULL,
    payload JSONB, -- Detailed event data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TRADING ACCOUNTS
CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add Index for fast queries
CREATE INDEX idx_logs_robot_id ON logs(robot_id);
CREATE INDEX idx_trade_history_robot_id ON trade_history(robot_id);
CREATE INDEX idx_snapshots_robot_id ON robot_snapshots(robot_id);

-- 6. TRADINGVIEW WEBHOOK LOGS (Audit & Idempotency)
CREATE TABLE tradingview_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id VARCHAR(50) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    bar_timestamp BIGINT NOT NULL,

    tv_symbol VARCHAR(50) NOT NULL,
    tv_ticker_id VARCHAR(100),
    timeframe VARCHAR(10) NOT NULL,

    open DECIMAL NOT NULL,
    high DECIMAL NOT NULL,
    low DECIMAL NOT NULL,
    close DECIMAL NOT NULL,
    volume DECIMAL,

    indicator_length INT,
    indicator_source VARCHAR(50),
    indicator_mult DECIMAL,
    indicator_mult2 DECIMAL,

    line1 DECIMAL,
    line2 DECIMAL,
    line3 DECIMAL,
    line4 DECIMAL,
    line5 DECIMAL,

    validation_status VARCHAR(20) NOT NULL, -- PASS / REJECT
    validation_errors JSONB,

    correlation_id VARCHAR(100),
    event_sequence BIGINT,

    payload_hash TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(robot_id, bar_timestamp, payload_hash)
);

CREATE INDEX idx_tv_logs_robot_id ON tradingview_webhook_logs(robot_id);
CREATE INDEX idx_tv_logs_bar_timestamp ON tradingview_webhook_logs(bar_timestamp);
CREATE INDEX idx_tv_logs_created_at ON tradingview_webhook_logs(created_at);

-- 7. CORE EVENTS (Decision Trace & Audit)
CREATE TABLE core_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- STRATEGY_SIGNAL_EVENT, STATE_TRANSITION_EVENT, etc.
    correlation_id VARCHAR(100) NOT NULL,
    parent_id VARCHAR(100),
    event_sequence BIGINT NOT NULL,
    payload JSONB NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_core_events_robot_created ON core_events(robot_id, created_at);
CREATE INDEX idx_core_events_correlation_seq ON core_events(correlation_id, event_sequence);
CREATE INDEX idx_core_events_parent ON core_events(parent_id);
CREATE INDEX idx_core_events_type_created ON core_events(event_type, created_at);

