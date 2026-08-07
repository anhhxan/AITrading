-- SEED DATA: AI TRADING PLATFORM (SPRINT 2A - 100% COMPLETE)

-- 1. Plugins Registry
INSERT INTO plugins (name, type, description) VALUES
('BB_MB', 'INDICATOR', 'Bollinger Bands + Moving Average Based Indicator'),
('HARSI', 'INDICATOR', 'Heikin-Ashi RSI Indicator'),
('BB_Strategy', 'STRATEGY', 'Breakout & Retracement Bollinger Strategy'),
('Market_Entry', 'ENTRY', 'Market Execution Entry'),
('ATR_Trailing', 'EXIT', 'ATR Trailing Stop Loss Exit'),
('Fixed_Risk', 'RISK', 'Fixed Risk % per Trade Allocation');

-- 2. System Settings
INSERT INTO system_settings (key, value, category, description) VALUES
('PAPER_FEE', '0.0004', 'Paper', 'Tỷ lệ phí mặc định (0.04%)'),
('PAPER_SLIPPAGE', '0.0002', 'Paper', 'Tỷ lệ trượt giá mặc định (0.02%)'),
('DEFAULT_TIMEOUT', '3', 'Execution', 'Số nến tối đa chờ khớp lệnh (Timeout)'),
('HEARTBEAT_INTERVAL', '"5s"', 'Health', 'Thời gian gửi Heartbeat của Robot');

-- 3. Providers
INSERT INTO providers (id, name, type) VALUES 
('11111111-1111-1111-1111-111111111111', 'Paper Trading', 'EXCHANGE'),
('22222222-2222-2222-2222-222222222222', 'Binance', 'EXCHANGE'),
('33333333-3333-3333-3333-333333333333', 'MT5 Exness', 'BROKER'),
('44444444-4444-4444-4444-444444444444', 'Bybit', 'EXCHANGE');

-- 4. Trading Calendars
INSERT INTO trading_calendars (symbol, timezone, market_open, market_close, days_of_week) VALUES
('BTCUSDT', 'UTC', '00:00', '23:59', '{1,2,3,4,5,6,7}'),
('ETHUSDT', 'UTC', '00:00', '23:59', '{1,2,3,4,5,6,7}'),
('XAUUSD', 'UTC', '00:00', '23:59', '{2,3,4,5,6}'); -- Mon to Fri

-- 5. Symbol Specs
INSERT INTO symbol_specs (provider_id, symbol, contract_size, tick_size, step_size, min_qty, price_precision, qty_precision) VALUES
('22222222-2222-2222-2222-222222222222', 'BTCUSDT', 1, 0.1, 0.001, 0.001, 1, 3),
('22222222-2222-2222-2222-222222222222', 'ETHUSDT', 1, 0.01, 0.01, 0.01, 2, 2),
('33333333-3333-3333-3333-333333333333', 'XAUUSD', 100, 0.001, 0.01, 0.01, 3, 2);

-- 6. Seed Profiles for Robot Demo
INSERT INTO robot_indicator_profiles (id, plugin_name, params) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'BB_MB', '{"length": 20, "mult1": 2.0, "mult2": 1.0}');

INSERT INTO robot_strategy_profiles (id, plugin_name, params) VALUES 
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'BB_Strategy', '{"retracementZonePercent": 20, "timeoutCandles": 3}');

INSERT INTO robot_entry_profiles (id, plugin_name, params) VALUES 
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Market_Entry', '{}');

INSERT INTO robot_exit_profiles (id, plugin_name, params) VALUES 
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ATR_Trailing', '{"atr_length": 14, "multiplier": 2}');

INSERT INTO robot_risk_profiles (id, plugin_name, params) VALUES 
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Fixed_Risk', '{"allocation_percent": 10, "leverage": 10}');
