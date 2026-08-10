BEGIN;

-- PHASE A: CREATE NEW TABLES FOR DATA CONTRACT V1.1

CREATE TABLE IF NOT EXISTS core_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL, -- FK added later
    event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    parent_id VARCHAR(100),
    event_sequence BIGINT NOT NULL,
    payload JSONB NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS robot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL,
    version INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    indicator_profile JSONB NOT NULL,
    strategy_profile JSONB NOT NULL,
    risk_profile JSONB NOT NULL,
    entry_profile JSONB NOT NULL,
    exit_profile JSONB NOT NULL,
    notification_profile JSONB,
    created_by UUID, -- Nullable for SET NULL
    applied_by UUID, -- Nullable for SET NULL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS robot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id UUID UNIQUE NOT NULL,
    robot_id UUID NOT NULL,
    user_id UUID, -- Nullable for SET NULL
    command_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'RECEIVED',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Nullable for SET NULL
    robot_id UUID NOT NULL,
    command_id UUID NOT NULL,
    command_type VARCHAR(100) NOT NULL,
    previous_state VARCHAR(50),
    requested_state VARCHAR(50),
    result JSONB,
    correlation_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PHASE A2: ADD MISSING COLUMNS
ALTER TABLE robots ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS current_state VARCHAR(50) DEFAULT 'IDLE';
ALTER TABLE robots ADD COLUMN IF NOT EXISTS current_state_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS active_config_version INT;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS trading_account_id UUID;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS worker_id VARCHAR(100);

ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS user_id UUID;

-- PHASE B: BACKFILL (SKIPPED AS NO EXISTING DATA)

-- PHASE C: CREATE INDEXES AND ENFORCE CONSTRAINTS
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_config ON robot_configs(robot_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_core_events_robot_created ON core_events(robot_id, created_at);
CREATE INDEX IF NOT EXISTS idx_core_events_correlation_seq ON core_events(correlation_id, event_sequence);
CREATE INDEX IF NOT EXISTS idx_core_events_parent ON core_events(parent_id);
CREATE INDEX IF NOT EXISTS idx_core_events_type_created ON core_events(event_type, created_at);

ALTER TABLE robots ALTER COLUMN slug SET NOT NULL;
ALTER TABLE robots ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trading_accounts ALTER COLUMN user_id SET NOT NULL;

-- FOREIGN KEYS WITH PROPER CASCADE/SET NULL RULES
ALTER TABLE robots 
    ADD CONSTRAINT fk_robots_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_robots_trading_account FOREIGN KEY (trading_account_id) REFERENCES trading_accounts(id) ON DELETE SET NULL;

ALTER TABLE trading_accounts
    ADD CONSTRAINT fk_trading_accounts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE robot_configs
    ADD CONSTRAINT fk_robot_configs_robot FOREIGN KEY (robot_id) REFERENCES robots(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_robot_configs_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_robot_configs_applied_by FOREIGN KEY (applied_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE robot_commands
    ADD CONSTRAINT fk_robot_commands_robot FOREIGN KEY (robot_id) REFERENCES robots(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_robot_commands_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_robot FOREIGN KEY (robot_id) REFERENCES robots(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE core_events
    ADD CONSTRAINT fk_core_events_robot FOREIGN KEY (robot_id) REFERENCES robots(id) ON DELETE RESTRICT;


-- PHASE D: CREATE ATOMIC RPCS
CREATE OR REPLACE FUNCTION apply_robot_config(
    p_robot_id UUID,
    p_config_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_robot_status VARCHAR;
    v_config_status VARCHAR;
    v_config_version INT;
    v_owner_id UUID;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT status, user_id INTO v_robot_status, v_owner_id FROM robots WHERE id = p_robot_id FOR UPDATE;
    IF v_robot_status IS NULL THEN
        RAISE EXCEPTION 'Robot not found';
    END IF;
    IF v_owner_id != v_uid THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT status, version INTO v_config_status, v_config_version FROM robot_configs WHERE id = p_config_id AND robot_id = p_robot_id FOR UPDATE;
    IF v_config_status IS NULL THEN
        RAISE EXCEPTION 'Config not found';
    END IF;
    
    IF v_config_status = 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Config is already active');
    END IF;

    UPDATE robot_configs SET status = 'ARCHIVED' WHERE robot_id = p_robot_id AND status = 'ACTIVE';
    UPDATE robot_configs SET status = 'ACTIVE', applied_at = NOW(), applied_by = v_uid WHERE id = p_config_id;
    UPDATE robots SET active_config_version = v_config_version WHERE id = p_robot_id;

    RETURN jsonb_build_object('success', true, 'new_version', v_config_version);
END;
$$;

CREATE OR REPLACE FUNCTION archive_robot(
    p_robot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_robot_status VARCHAR;
    v_current_state VARCHAR;
    v_owner_id UUID;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT status, current_state, user_id INTO v_robot_status, v_current_state, v_owner_id FROM robots WHERE id = p_robot_id FOR UPDATE;
    IF v_robot_status IS NULL THEN
        RAISE EXCEPTION 'Robot not found';
    END IF;
    IF v_owner_id != v_uid THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_current_state IN ('POSITION_OPEN', 'EXECUTION_PENDING', 'EXIT_PENDING') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot archive robot while in active trading state');
    END IF;

    UPDATE robots SET status = 'ARCHIVED' WHERE id = p_robot_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- PHASE E: ENABLE RLS & POLICIES
ALTER TABLE robots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_events ENABLE ROW LEVEL SECURITY;

-- robots
DROP POLICY IF EXISTS "Users can view their own robots" ON robots;
CREATE POLICY "Users can view their own robots" ON robots FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own robots" ON robots;
CREATE POLICY "Users can insert their own robots" ON robots FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own robots" ON robots;
CREATE POLICY "Users can update their own robots" ON robots FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own robots" ON robots;
CREATE POLICY "Users can delete their own robots" ON robots FOR DELETE USING (auth.uid() = user_id);

-- trading_accounts
DROP POLICY IF EXISTS "Users can view their own trading accounts" ON trading_accounts;
CREATE POLICY "Users can view their own trading accounts" ON trading_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own trading accounts" ON trading_accounts;
CREATE POLICY "Users can insert their own trading accounts" ON trading_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own trading accounts" ON trading_accounts;
CREATE POLICY "Users can update their own trading accounts" ON trading_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own trading accounts" ON trading_accounts;
CREATE POLICY "Users can delete their own trading accounts" ON trading_accounts FOR DELETE USING (auth.uid() = user_id);

-- robot_configs
DROP POLICY IF EXISTS "Users can view their own robot configs" ON robot_configs;
CREATE POLICY "Users can view their own robot configs" ON robot_configs FOR SELECT USING (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own robot configs" ON robot_configs;
CREATE POLICY "Users can insert their own robot configs" ON robot_configs FOR INSERT WITH CHECK (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
-- Users shouldn't freely UPDATE/DELETE configs, they are immutable after creation/application, but we can restrict via UI/backend. For RLS, let's keep it secure.
DROP POLICY IF EXISTS "Users can update their own robot configs" ON robot_configs;
CREATE POLICY "Users can update their own robot configs" ON robot_configs FOR UPDATE USING (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));

-- robot_commands
DROP POLICY IF EXISTS "Users can view their own commands" ON robot_commands;
CREATE POLICY "Users can view their own commands" ON robot_commands FOR SELECT USING (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own commands" ON robot_commands;
CREATE POLICY "Users can insert their own commands" ON robot_commands FOR INSERT WITH CHECK (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
-- Command update usually done by Core Engine (Service Role), but we allow frontend to see it.

-- audit_logs
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
CREATE POLICY "Users can view their own audit logs" ON audit_logs FOR SELECT USING (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
-- NO INSERT/UPDATE/DELETE FOR audit_logs (only Service Role can mutate)

-- core_events
DROP POLICY IF EXISTS "Users can view their own core events" ON core_events;
CREATE POLICY "Users can view their own core events" ON core_events FOR SELECT USING (robot_id IN (SELECT id FROM robots WHERE user_id = auth.uid()));
-- NO INSERT/UPDATE/DELETE FOR core_events (only Service Role can mutate)

COMMIT;
