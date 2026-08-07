-- RLS POLICIES (SPRINT 2A)

-- Bật RLS cho tất cả các bảng
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbol_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_indicator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_strategy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robots ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_snapshots ENABLE ROW LEVEL SECURITY;

-- 1. System Settings & Providers (Mọi người có thể đọc, chỉ Admin sửa)
CREATE POLICY "Public Read System Settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Providers" ON providers FOR SELECT USING (true);
CREATE POLICY "Public Read Calendars" ON trading_calendars FOR SELECT USING (true);
CREATE POLICY "Public Read Symbol Specs" ON symbol_specs FOR SELECT USING (true);

-- 2. Tài sản thuộc sở hữu User (Robots, Accounts)
-- Chỉ owner_id mới được SELECT, INSERT, UPDATE. Không cho DELETE vì dùng Soft Delete.

-- Robots
CREATE POLICY "Users can view own robots" ON robots
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create robots" ON robots
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own robots" ON robots
    FOR UPDATE USING (auth.uid() = owner_id);

-- Trading Accounts
CREATE POLICY "Users can view own trading accounts" ON trading_accounts
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can manage own trading accounts" ON trading_accounts
    FOR ALL USING (auth.uid() = owner_id);

-- 3. Các bảng con phụ thuộc (Thông qua Robot ID)
-- Ví dụ: Users chỉ được xem robot_events của Robot mà họ sở hữu
CREATE POLICY "Users can view own robot events" ON robot_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM robots 
            WHERE robots.id = robot_events.robot_id 
            AND robots.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own robot events" ON robot_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM robots 
            WHERE robots.id = robot_events.robot_id 
            AND robots.owner_id = auth.uid()
        )
    );

-- Tương tự cho positions, trade_history, snapshots...
-- (Mẫu policy này sẽ được áp dụng cho toàn bộ các bảng con)
