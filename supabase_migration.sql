-- Migration for Phase 3.7: Add is_armed for Reversal & Recovery
ALTER TABLE public.active_setups ADD COLUMN IF NOT EXISTS is_armed BOOLEAN DEFAULT false;
