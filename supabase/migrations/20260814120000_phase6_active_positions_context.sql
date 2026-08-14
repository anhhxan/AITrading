BEGIN;

ALTER TABLE public.active_positions
ADD COLUMN IF NOT EXISTS context_snapshot JSONB DEFAULT '{}'::jsonb;

COMMIT;
