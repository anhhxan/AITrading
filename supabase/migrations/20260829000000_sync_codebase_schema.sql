-- 20260829000000_sync_codebase_schema.sql

-- 1. ADD MISSING COLUMNS TO ROBOTS (Idempotent)
ALTER TABLE public.robots 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS signal_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trading_view_symbol VARCHAR(100),
  ADD COLUMN IF NOT EXISTS execution_symbol VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trading_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trading_session VARCHAR(50),
  ADD COLUMN IF NOT EXISTS paper_balance NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS indicator_profile JSONB,
  ADD COLUMN IF NOT EXISTS strategy_profile JSONB,
  ADD COLUMN IF NOT EXISTS risk_profile JSONB,
  ADD COLUMN IF NOT EXISTS entry_profile JSONB,
  ADD COLUMN IF NOT EXISTS exit_profile JSONB,
  ADD COLUMN IF NOT EXISTS notification_profile JSONB;

-- 2. MAKE LEGACY COLUMNS NULLABLE SO THEY DON'T BLOCK INSERTS
ALTER TABLE public.robots ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.robots ALTER COLUMN symbol DROP NOT NULL;

-- 3. FIX RLS POLICIES FOR ROBOTS
-- We drop the legacy owner_id policies to ensure it doesn't conflict, 
-- or we can just leave them since they are ORed. 
-- Wait, if owner_id is null, `auth.uid() = owner_id` is false, but `auth.uid() = user_id` is true. 
-- Because Postgres combines with OR, the INSERT will pass!
-- However, for cleanliness, let's drop the ones based on owner_id if they exist, 
-- and ensure the user_id policies exist.
-- To be safe, we just leave them or recreate them.
-- Actually, the user said "Nếu D2 chứng minh RLS không tương thích... sửa RLS... Mục tiêu: User authenticated: CREATE robot với user_id = auth.uid(), SELECT/UPDATE/DELETE robot của chính mình."

-- The target already has "Users can insert their own robots" with user_id, 
-- but let's make sure it's strictly correct.
DROP POLICY IF EXISTS "Users insert own robots" ON public.robots;
DROP POLICY IF EXISTS "Users update own robots" ON public.robots;
DROP POLICY IF EXISTS "Users view own robots" ON public.robots;

-- Ensure user_id policies
-- Note: "Users can insert their own robots" already exists, but we'll recreate them to be safe and clean.
DROP POLICY IF EXISTS "Users can insert their own robots" ON public.robots;
CREATE POLICY "Users can insert their own robots" ON public.robots FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own robots" ON public.robots;
CREATE POLICY "Users can view their own robots" ON public.robots FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own robots" ON public.robots;
CREATE POLICY "Users can update their own robots" ON public.robots FOR UPDATE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own robots" ON public.robots;
CREATE POLICY "Users can delete their own robots" ON public.robots FOR DELETE TO public USING (auth.uid() = user_id);

-- Ensure active_setups, execution_intents, active_positions, active_orders, robot_configs
-- All these check `EXISTS (SELECT 1 FROM robots WHERE robots.id = ... AND robots.user_id = auth.uid())`
-- This was confirmed in target_audit.json! The policies for these tables ALREADY use `robots.user_id = auth.uid()`.
-- Example from audit: `(EXISTS ( SELECT 1 FROM robots WHERE ((robots.id = active_orders.robot_id) AND (robots.user_id = auth.uid()))))`
-- So RLS for dependent tables is ALREADY correct for `user_id`!
