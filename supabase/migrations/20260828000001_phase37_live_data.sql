-- BƯỚC 1: TẠO BẢNG active_setups ĐỂ QUẢN LÝ DỮ LIỆU SỐNG (LIVE)
CREATE TABLE IF NOT EXISTS public.active_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id UUID NOT NULL REFERENCES public.robots(id) ON DELETE CASCADE,
    setup_id VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL, -- PENDING, ARM, ACTIVE
    direction VARCHAR(10) NOT NULL, -- LONG, SHORT
    trigger_price DECIMAL NULL,
    stop_price DECIMAL NULL,
    snapshot JSONB NULL, -- Lưu metadata như B1-B5
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_active_setups_robot_setup UNIQUE (robot_id, setup_id)
);

ALTER TABLE public.active_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own active_setups" ON public.active_setups 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.robots WHERE robots.id = active_setups.robot_id AND robots.user_id = auth.uid()));

CREATE POLICY "Users insert own active_setups" ON public.active_setups 
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.robots WHERE robots.id = active_setups.robot_id AND robots.user_id = auth.uid()));

CREATE POLICY "Users update own active_setups" ON public.active_setups 
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.robots WHERE robots.id = active_setups.robot_id AND robots.user_id = auth.uid()));

CREATE POLICY "Users delete own active_setups" ON public.active_setups 
    FOR DELETE USING (EXISTS (SELECT 1 FROM public.robots WHERE robots.id = active_setups.robot_id AND robots.user_id = auth.uid()));

-- BƯỚC 2: THÊM CỘT setup_id VÀO CÁC BẢNG EXECUTION & POSITION
ALTER TABLE public.execution_intents 
ADD COLUMN IF NOT EXISTS setup_id VARCHAR(255) NULL;

ALTER TABLE public.active_orders 
ADD COLUMN IF NOT EXISTS setup_id VARCHAR(255) NULL;

ALTER TABLE public.active_positions 
ADD COLUMN IF NOT EXISTS setup_id VARCHAR(255) NULL;

ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS setup_id VARCHAR(255) NULL;

-- BƯỚC 3: INDEX CHO CÁC BẢNG SỐNG ĐỂ TỐI ƯU DELETE/UPDATE
CREATE INDEX IF NOT EXISTS idx_active_setups_robot_id ON public.active_setups(robot_id);
CREATE INDEX IF NOT EXISTS idx_active_setups_setup_id ON public.active_setups(setup_id);

CREATE INDEX IF NOT EXISTS idx_exec_intents_setup_id ON public.execution_intents(setup_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_setup_id ON public.active_orders(setup_id);
CREATE INDEX IF NOT EXISTS idx_active_positions_setup_id ON public.active_positions(setup_id);
