BEGIN;

-- 1. robots
ALTER TABLE public.robots
ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. execution_intents
CREATE TABLE IF NOT EXISTS public.execution_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES public.robots(id) ON DELETE RESTRICT,
    signal_id VARCHAR(255) NOT NULL,
    client_order_id VARCHAR(36) NOT NULL,
    action VARCHAR(20) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    quantity DECIMAL NOT NULL,
    price DECIMAL NULL,
    leverage INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_execution_intents_client_order_id UNIQUE (client_order_id),
    CONSTRAINT uq_execution_intents_robot_signal UNIQUE (robot_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_intents_status_created ON public.execution_intents (status, created_at);

-- 3. active_orders
CREATE TABLE IF NOT EXISTS public.active_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id UUID NOT NULL REFERENCES public.execution_intents(id) ON DELETE RESTRICT,
    robot_id UUID NOT NULL REFERENCES public.robots(id) ON DELETE RESTRICT,
    binance_order_id VARCHAR(100) NOT NULL,
    client_order_id VARCHAR(36) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    quantity DECIMAL NOT NULL,
    price DECIMAL NULL,
    filled_quantity DECIMAL NOT NULL DEFAULT 0,
    average_fill_price DECIMAL NULL,
    status VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_active_orders_binance_order_id UNIQUE (binance_order_id),
    CONSTRAINT uq_active_orders_client_order_id UNIQUE (client_order_id)
);

CREATE INDEX IF NOT EXISTS idx_active_orders_robot_status ON public.active_orders (robot_id, status);

-- 4. active_positions
CREATE TABLE IF NOT EXISTS public.active_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES public.robots(id) ON DELETE RESTRICT,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL,
    quantity DECIMAL NOT NULL,
    entry_price DECIMAL NOT NULL,
    leverage INTEGER NOT NULL,
    unrealized_pnl DECIMAL NOT NULL DEFAULT 0,
    realized_pnl DECIMAL NOT NULL DEFAULT 0,
    stop_loss_price DECIMAL NULL,
    take_profit_price DECIMAL NULL,
    binance_position_id VARCHAR(100) NULL,
    last_synced_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_active_positions_robot_symbol UNIQUE (robot_id, symbol)
);

-- 5. RLS
ALTER TABLE public.execution_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_positions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors on retry
DROP POLICY IF EXISTS "Users can view their own execution intents" ON public.execution_intents;
DROP POLICY IF EXISTS "Users can view their own active orders" ON public.active_orders;
DROP POLICY IF EXISTS "Users can view their own active positions" ON public.active_positions;

CREATE POLICY "Users can view their own execution intents" ON public.execution_intents
FOR SELECT USING (robot_id IN (SELECT id FROM public.robots WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own active orders" ON public.active_orders
FOR SELECT USING (robot_id IN (SELECT id FROM public.robots WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own active positions" ON public.active_positions
FOR SELECT USING (robot_id IN (SELECT id FROM public.robots WHERE user_id = auth.uid()));

-- Note: No INSERT, UPDATE, or DELETE policies are created for frontend users.
-- The Worker uses the Service Role key and bypasses RLS entirely for mutation.

COMMIT;
