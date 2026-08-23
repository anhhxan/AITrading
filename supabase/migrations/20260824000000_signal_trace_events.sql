-- 20260824000000_signal_trace_events.sql
CREATE TABLE signal_trace_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    robot_id uuid NOT NULL REFERENCES robots(id),
    bar_timestamp bigint NOT NULL,
    time_utc timestamptz NOT NULL,
    timeframe text NOT NULL,
    tv_symbol text,
    tv_ticker_id text,
    
    candle_trace_id text NOT NULL,
    correlation_id text,
    command_id uuid,
    request_id text,
    
    tv_status text DEFAULT 'UNKNOWN',
    cf_status text DEFAULT 'UNKNOWN',
    vercel_status text DEFAULT 'UNKNOWN',
    db_status text DEFAULT 'UNKNOWN',
    poller_status text DEFAULT 'UNKNOWN',
    adapter_status text DEFAULT 'UNKNOWN',
    strategy_status text DEFAULT 'UNKNOWN',
    
    strategy_result text,
    diagnostics jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(robot_id, bar_timestamp)
);

-- Index for querying
CREATE INDEX idx_signal_trace_events_robot_time ON signal_trace_events (robot_id, bar_timestamp DESC);

-- Enable RLS
ALTER TABLE signal_trace_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see traces for robots they own.
-- Since owner_id is removed, we use robots.user_id = auth.uid()
CREATE POLICY "Users can view signal trace events of their robots"
ON signal_trace_events
FOR SELECT
TO authenticated
USING (
    robot_id IN (
        SELECT id FROM robots WHERE user_id = auth.uid()
    )
);

-- Service role can do everything
CREATE POLICY "Service role can manage all signal trace events"
ON signal_trace_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
