-- INITIAL SCHEMA: AI TRADING PLATFORM (SPRINT 2A)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE robot_state AS ENUM ('CREATED', 'STOPPED', 'WAIT_SIGNAL', 'SIGNAL_DETECTED', 'WAIT_RETRACEMENT', 'READY_TO_ENTER', 'POSITION_OPEN', 'WAIT_EXIT', 'ERROR', 'ARCHIVED');
CREATE TYPE account_mode AS ENUM ('PAPER', 'TESTNET', 'LIVE');
CREATE TYPE position_side AS ENUM ('LONG', 'SHORT');
CREATE TYPE trade_reason AS ENUM ('TAKE_PROFIT', 'STOP_LOSS', 'TIMEOUT', 'MANUAL', 'ERROR');
CREATE TYPE event_type AS ENUM ('STATE_CHANGE', 'SIGNAL', 'ERROR', 'INFO');

-- ==============================================
-- 1. SYSTEM & MARKETS
-- ==============================================

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
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

-- ==============================================
-- 2. ACCOUNTS & PROFILES
-- ==============================================

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL, -- references auth.users in Supabase
    provider_id UUID REFERENCES providers(id),
    name VARCHAR(100) NOT NULL,
    mode account_mode NOT NULL,
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Robot Profiles (No overuse of JSONB, separate tables)
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

-- (Skipping entry/exit/risk profiles for brevity, assuming similar structure)

-- ==============================================
-- 3. ROBOT LIFECYCLE
-- ==============================================

CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    trading_account_id UUID REFERENCES trading_accounts(id),
    symbol VARCHAR(50) NOT NULL,
    state robot_state DEFAULT 'CREATED',
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- 4. EVENTS & SNAPSHOTS (APPEND-ONLY)
-- ==============================================

CREATE TABLE robot_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    event_type event_type NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
    -- No updated_at, no deleted_at (Append Only)
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

-- ==============================================
-- 5. TRADING OPERATIONS
-- ==============================================

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    robot_id UUID REFERENCES robots(id),
    side position_side NOT NULL,
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
    close_reason trade_reason NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
    -- Append Only
);

CREATE TABLE trade_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trade_history(id),
    indicator_snapshot JSONB NOT NULL,
    strategy_snapshot JSONB NOT NULL,
    risk_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
