-- SEED DATA: AI TRADING PLATFORM (SPRINT 2A)

-- 1. System Settings
INSERT INTO system_settings (key, value) VALUES
('PAPER_FEE', '0.0004'),          -- 0.04%
('PAPER_SLIPPAGE', '0.0002'),     -- 0.02%
('DEFAULT_TIMEOUT', '3'),         -- 3 candles
('HEARTBEAT_INTERVAL', '"5s"');

-- 2. Providers
INSERT INTO providers (id, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'Paper Trading'),
('22222222-2222-2222-2222-222222222222', 'Binance'),
('33333333-3333-3333-3333-333333333333', 'MT5 Exness'),
('44444444-4444-4444-4444-444444444444', 'Bybit');

-- 3. Trading Calendars
INSERT INTO trading_calendars (symbol, market_open, market_close, days_of_week) VALUES
('BTCUSDT', '00:00', '23:59', '{1,2,3,4,5,6,7}'),
('ETHUSDT', '00:00', '23:59', '{1,2,3,4,5,6,7}'),
('XAUUSD', '00:00', '23:59', '{2,3,4,5,6}'); -- Mon to Fri

-- 4. Symbol Specs
INSERT INTO symbol_specs (provider_id, symbol, tick_size, step_size, min_qty, price_precision, qty_precision) VALUES
('22222222-2222-2222-2222-222222222222', 'BTCUSDT', 0.1, 0.001, 0.001, 1, 3),
('22222222-2222-2222-2222-222222222222', 'ETHUSDT', 0.01, 0.01, 0.01, 2, 2);

-- 5. Seed Profiles for Robot Demo
INSERT INTO robot_indicator_profiles (id, plugin_name, params) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'BB_MB', '{"length": 20, "mult1": 2.0, "mult2": 1.0}');

INSERT INTO robot_strategy_profiles (id, plugin_name, params) VALUES 
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'BB_Strategy', '{"retracementZonePercent": 20, "timeoutCandles": 3}');

-- Assume user owner_id is a known dummy UUID for seed purposes
-- In production, this would be created via API.
