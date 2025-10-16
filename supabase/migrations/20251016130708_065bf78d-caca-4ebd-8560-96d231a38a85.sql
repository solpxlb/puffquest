-- Migration: Direct $SMOKE Rewards System
-- Remove points system, users now earn $SMOKE directly

-- 1. Update profiles table (deprecate total_points_earned)
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS total_points_earned;

-- 2. Update puff_events table (rename points_awarded to smoke_awarded)
ALTER TABLE public.puff_events 
  RENAME COLUMN points_awarded TO smoke_awarded;

-- 3. Update puff_sessions table (rename points_earned to smoke_earned)
ALTER TABLE public.puff_sessions 
  RENAME COLUMN points_earned TO smoke_earned;

-- 4. Update smoke_transactions table (remove points_converted column)
ALTER TABLE public.smoke_transactions 
  DROP COLUMN IF EXISTS points_converted;

-- 5. Update global_stats table (remove points tracking)
ALTER TABLE public.global_stats 
  DROP COLUMN IF EXISTS total_points_distributed,
  DROP COLUMN IF EXISTS current_conversion_rate;