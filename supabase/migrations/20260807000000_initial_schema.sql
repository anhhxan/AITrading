-- INITIAL SCHEMA: AI TRADING PLATFORM (SPRINT 2A - 100% COMPLETE)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE robot_state AS ENUM ('CREATED', 'STOPPED', 'WAIT_SIGNAL', 'SIGNAL_DETECTED', 'WAIT_RETRACEMENT', 'READY_TO_ENTER', 'POSITION_OPEN', 'WAIT_EXIT', 'ERROR', 'ARCHIVED');
CREATE TYPE account_mode AS ENUM ('PAPER', 'TESTNET', 'LIVE');
CREATE TYPE account_status AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');
CREATE TYPE position_side AS ENUM ('LONG', 'SHORT');
CREATE TYPE position_status AS ENUM ('OPEN', 'CLOSING', 'CLOSED');
CREATE TYPE trade_reason AS ENUM ('TAKE_PROFIT', 'STOP_LOSS', 'TIMEOUT', 'MANUAL', 'ERROR');
CREATE TYPE event_type AS ENUM ('STATE_CHANGE', 'SIGNAL', 'ERROR', 'INFO');
CREATE TYPE provider_type AS ENUM ('EXCHANGE', 'BROKER');
CREATE TYPE plugin_type AS ENUM ('INDICATOR', 'STRATEGY', 'ENTRY', 'EXIT', 'RISK', 'NOTIFICATION');

-- ==============================================
-- 1. SYSTEM & PLUGINS
-- ==============================================

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type plugin_type NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- 2. MARKETS & PROVIDERS
-- ==============================================

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type provider_type NOT NULL DEFAULT 'EXCHANGE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE trading_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    market_open TIME,
    market_close TIME,
    days_of_week INT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE symbol_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id),
    symbol VARCHAR(50) NOT NULL,
    contract_size NUMERIC DEFAULT 1,
    tick_size NUMERIC,
    step_size NUMERIC,
    min_qty NUMERIC,
    max_qty NUMERIC,
    price_precision INT,
    qty_precision INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_symbol_specs_provider ON symbol_specs(provider_id);

-- ==============================================
-- 3. ACCOUNTS & CONFIG PROFILES
-- ==============================================

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL, 
    provider_id UUID REFERENCES providers(id),
    name VARCHAR(100) NOT NULL,
    mode account_mode NOT NULL,
    connection_status account_status DEFAULT 'DISCONNECTED',
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    encrypted_at TIMESTAMPTZ,
    key_version VARCHAR(50),
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_indicator_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_strategy_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_entry_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_exit_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_risk_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_notification_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- 4. ROBOT LIFECYCLE
-- ==============================================

CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    trading_account_id UUID REFERENCES trading_accounts(id),
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    state robot_state DEFAULT 'CREATED',
    current_version_id UUID, -- Will be set after version is created
    last_state_changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_robots_owner ON robots(owner_id);
CREATE INDEX idx_robots_state ON robots(state);

CREATE TABLE robot_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    major INT NOT NULL DEFAULT 1,
    minor INT NOT NULL DEFAULT 0,
    patch INT NOT NULL DEFAULT 0,
    indicator_profile_id UUID REFERENCES robot_indicator_profiles(id),
    strategy_profile_id UUID REFERENCES robot_strategy_profiles(id),
    entry_profile_id UUID REFERENCES robot_entry_profiles(id),
    exit_profile_id UUID REFERENCES robot_exit_profiles(id),
    risk_profile_id UUID REFERENCES robot_risk_profiles(id),
    notification_profile_id UUID REFERENCES robot_notification_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Add foreign key constraint back to robots
ALTER TABLE robots ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES robot_versions(id);

CREATE TABLE robot_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    start_time TIME,
    end_time TIME,
    days_of_week INT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- 5. EVENTS, LOGS & SNAPSHOTS (APPEND-ONLY)
-- ==============================================

CREATE TABLE robot_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    event_type event_type NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);
CREATE INDEX idx_robot_events_robot_id ON robot_events(robot_id);
CREATE INDEX idx_robot_events_created_at ON robot_events(created_at);

CREATE TABLE robot_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    state_snapshot JSONB NOT NULL,
    config_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE TABLE robot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- ==============================================
-- 6. HEALTH & PERFORMANCE
-- ==============================================

CREATE TABLE robot_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    cpu_usage NUMERIC,
    ram_usage NUMERIC,
    latency_ms INT,
    last_heartbeat_at TIMESTAMPTZ,
    last_candle_at TIMESTAMPTZ,
    last_signal_at TIMESTAMPTZ,
    last_position_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE robot_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    total_trades INT DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    profit_factor NUMERIC DEFAULT 0,
    sharpe_ratio NUMERIC DEFAULT 0,
    max_drawdown NUMERIC DEFAULT 0,
    largest_win NUMERIC DEFAULT 0,
    largest_loss NUMERIC DEFAULT 0,
    consecutive_wins INT DEFAULT 0,
    consecutive_losses INT DEFAULT 0,
    avg_holding_time_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- 7. TRADING OPERATIONS
-- ==============================================

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    side position_side NOT NULL,
    status position_status DEFAULT 'OPEN',
    entry_price NUMERIC NOT NULL,
    size NUMERIC NOT NULL,
    unrealized_pnl NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_positions_robot_id ON positions(robot_id);

CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    side position_side NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC NOT NULL,
    size NUMERIC NOT NULL,
    realized_pnl NUMERIC NOT NULL,
    fee NUMERIC NOT NULL,
    slippage NUMERIC NOT NULL,
    duration_seconds INT NOT NULL,
    close_reason trade_reason NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE TABLE trade_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trade_history(id),
    indicator_snapshot JSONB NOT NULL,
    strategy_snapshot JSONB NOT NULL,
    entry_snapshot JSONB NOT NULL,
    exit_snapshot JSONB NOT NULL,
    risk_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
