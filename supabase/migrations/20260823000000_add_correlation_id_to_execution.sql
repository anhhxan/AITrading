
ALTER TABLE execution_intents ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;
ALTER TABLE active_orders ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;
ALTER TABLE active_positions ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;
ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;

