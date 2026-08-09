-- ==========================================
-- AI TRADING PLATFORM V1.1 (ENTERPRISE)
-- SUPABASE POSTGRESQL SCHEMA
-- ==========================================

-- 1. TRADING ROBOTS (Digital Employees)
CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'CREATED', -- CREATED, CONFIGURED, READY, RUNNING, PAUSED, STOPPED, ERROR, ARCHIVED
    timeframe VARCHAR(10) NOT NULL, -- e.g., 3H
    signal_source VARCHAR(50) NOT NULL, -- e.g., Binance, TradingView Reference
    trading_view_symbol VARCHAR(50) NOT NULL, -- e.g., BTCUSDT
    execution_symbol VARCHAR(50) NOT NULL, -- e.g., BTCUSDT
    provider VARCHAR(50) NOT NULL, -- e.g., Binance Futures, MT5
    trading_account_id UUID, -- Reference to a trading_accounts table (not defined here for brevity)
    
    -- JSON Profiles (Plugins)
    indicator_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    strategy_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    entry_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    exit_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Session & Mapping
    trading_session VARCHAR(50) DEFAULT '24/7',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
