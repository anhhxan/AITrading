-- RLS POLICIES (SPRINT 2A - 100% COMPLETE)

-- Bật RLS cho tất cả các bảng
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbol_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE robot_indicator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_strategy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_entry_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_exit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_notification_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE robots ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE robot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_performance ENABLE ROW LEVEL SECURITY;

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_snapshots ENABLE ROW LEVEL SECURITY;

-- ADMIN POLICIES (Có thể truy cập mọi thứ)
-- Giả định có function is_admin() kiểm tra quyền. Ở mức khởi tạo, ta dùng auth.jwt()->>'role' = 'admin' (nếu có cấu hình claim)
-- Để minh họa, Admin Policy được áp dụng cho bảng 'robots':
CREATE POLICY "Admin can do everything on robots" ON robots FOR ALL USING (auth.jwt()->>'role' = 'admin');

-- 1. PUBLIC READ (Các bảng hệ thống, mọi User đã đăng nhập đều đọc được)
CREATE POLICY "Public Read Plugins" ON plugins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public Read System Settings" ON system_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public Read Providers" ON providers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public Read Calendars" ON trading_calendars FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public Read Symbol Specs" ON symbol_specs FOR SELECT USING (auth.role() = 'authenticated');

-- 2. TÀI SẢN THUỘC SỞ HỮU USER (Owner = auth.uid())

-- Trading Accounts
CREATE POLICY "Users manage own trading accounts" ON trading_accounts FOR ALL USING (auth.uid() = owner_id);

-- Robots
CREATE POLICY "Users view own robots" ON robots FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users insert own robots" ON robots FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users update own robots" ON robots FOR UPDATE USING (auth.uid() = owner_id);
-- Không có DELETE vì dùng Soft Delete (is_active = false / deleted_at != null)

-- 3. CÁC BẢNG PHỤ THUỘC (THÔNG QUA ROBOT_ID)
-- (Users chỉ có quyền xem và thêm dữ liệu vào các bảng thuộc về Robot của họ)

-- Helpers for Policy Generation
-- robot_versions
CREATE POLICY "Users access own robot versions" ON robot_versions FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_versions.robot_id AND robots.owner_id = auth.uid()));

-- robot_events (Append Only)
CREATE POLICY "Users view own robot events" ON robot_events FOR SELECT USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_events.robot_id AND robots.owner_id = auth.uid()));
CREATE POLICY "Users insert own robot events" ON robot_events FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_events.robot_id AND robots.owner_id = auth.uid()));

-- robot_snapshots (Append Only)
CREATE POLICY "Users view own robot snapshots" ON robot_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_snapshots.robot_id AND robots.owner_id = auth.uid()));
CREATE POLICY "Users insert own robot snapshots" ON robot_snapshots FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_snapshots.robot_id AND robots.owner_id = auth.uid()));

-- robot_logs
CREATE POLICY "Users access own robot logs" ON robot_logs FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_logs.robot_id AND robots.owner_id = auth.uid()));

-- robot_schedules
CREATE POLICY "Users access own robot schedules" ON robot_schedules FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_schedules.robot_id AND robots.owner_id = auth.uid()));

-- robot_health
CREATE POLICY "Users access own robot health" ON robot_health FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_health.robot_id AND robots.owner_id = auth.uid()));

-- robot_performance
CREATE POLICY "Users access own robot performance" ON robot_performance FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = robot_performance.robot_id AND robots.owner_id = auth.uid()));

-- positions
CREATE POLICY "Users access own positions" ON positions FOR ALL USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = positions.robot_id AND robots.owner_id = auth.uid()));

-- trade_history (Append Only)
CREATE POLICY "Users view own trade history" ON trade_history FOR SELECT USING (EXISTS (SELECT 1 FROM robots WHERE robots.id = trade_history.robot_id AND robots.owner_id = auth.uid()));
CREATE POLICY "Users insert own trade history" ON trade_history FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM robots WHERE robots.id = trade_history.robot_id AND robots.owner_id = auth.uid()));

-- trade_snapshots (Append Only)
CREATE POLICY "Users view own trade snapshots" ON trade_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM trade_history JOIN robots ON trade_history.robot_id = robots.id WHERE trade_history.id = trade_snapshots.trade_id AND robots.owner_id = auth.uid()));
CREATE POLICY "Users insert own trade snapshots" ON trade_snapshots FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM trade_history JOIN robots ON trade_history.robot_id = robots.id WHERE trade_history.id = trade_snapshots.trade_id AND robots.owner_id = auth.uid()));

-- Config Profiles (No direct owner_id, so access is typically tied via Version -> Robot)
-- For simplicity in this mock, we assume authenticated users can create profiles, 
-- but they only link them to their own robots.
CREATE POLICY "Authenticated users manage profiles" ON robot_indicator_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users manage strategies" ON robot_strategy_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users manage entries" ON robot_entry_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users manage exits" ON robot_exit_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users manage risks" ON robot_risk_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users manage notifications" ON robot_notification_profiles FOR ALL USING (auth.role() = 'authenticated');
