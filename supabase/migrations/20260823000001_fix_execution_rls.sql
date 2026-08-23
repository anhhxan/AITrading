-- Fix RLS policies for trading execution tables that still reference the old owner_id column
-- Since robots.owner_id was replaced by robots.user_id, these policies must be updated
-- to prevent "column owner_id does not exist" errors that silently fail the UI data fetching.

-- 1. active_orders
DROP POLICY IF EXISTS "Users access own active_orders" ON active_orders;
CREATE POLICY "Users access own active_orders" ON active_orders FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = active_orders.robot_id AND robots.user_id = auth.uid()));

-- 2. active_positions
DROP POLICY IF EXISTS "Users access own active_positions" ON active_positions;
CREATE POLICY "Users access own active_positions" ON active_positions FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = active_positions.robot_id AND robots.user_id = auth.uid()));

-- 3. execution_intents
DROP POLICY IF EXISTS "Users access own execution_intents" ON execution_intents;
CREATE POLICY "Users access own execution_intents" ON execution_intents FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = execution_intents.robot_id AND robots.user_id = auth.uid()));

-- 4. trade_history
DROP POLICY IF EXISTS "Users view own trade history" ON trade_history;
CREATE POLICY "Users view own trade history" ON trade_history FOR SELECT USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = trade_history.robot_id AND robots.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users insert own trade history" ON trade_history;
CREATE POLICY "Users insert own trade history" ON trade_history FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM robots WHERE robots.id = trade_history.robot_id AND robots.user_id = auth.uid()));

-- 5. positions (if applicable)
DROP POLICY IF EXISTS "Users access own positions" ON positions;
CREATE POLICY "Users access own positions" ON positions FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = positions.robot_id AND robots.user_id = auth.uid()));
