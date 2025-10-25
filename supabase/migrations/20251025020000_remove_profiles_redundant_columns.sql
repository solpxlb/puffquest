-- ============================================
-- REMOVE REDUNDANT COLUMNS FROM PROFILES TABLE
-- ============================================
-- This migration removes duplicate columns that are now handled by the unified user_smoke_balance table
-- These columns are fully redundant due to the automated triggers and data migration

-- Remove redundant columns from profiles table
-- These are now handled by user_smoke_balance table with automated sync

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS smoke_balance,
DROP COLUMN IF EXISTS total_smoke_earned,
DROP COLUMN IF EXISTS total_puffs,
DROP COLUMN IF EXISTS device_levels,
DROP COLUMN IF EXISTS last_passive_claim,
DROP COLUMN IF EXISTS streak_days,
DROP COLUMN IF EXISTS last_active_date;

-- Remove the now-obsolete sync trigger since we're removing the synced columns
DROP TRIGGER IF EXISTS tr_create_user_balance_on_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.create_user_balance_on_profile();

-- Add comments to document the clean separation of concerns
COMMENT ON TABLE public.profiles IS 'User profile information - core wallet and vices data only. Balance and earnings data moved to user_smoke_balance table.';
COMMENT ON TABLE public.user_smoke_balance IS 'Unified balance and earnings table - single source of truth for all $SMOKE related data.';

-- Verify the table structure after cleanup
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND table_schema = 'public'
-- ORDER BY ordinal_position;