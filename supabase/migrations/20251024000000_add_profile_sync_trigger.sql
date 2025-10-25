-- Migration: Add Profile Sync Trigger
-- Automatically syncs puff_sessions data to profiles table
-- Ensures total_smoke_earned and total_puffs are always accurate

-- 1. Create function to update profile totals from puff_sessions
CREATE OR REPLACE FUNCTION update_profile_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's profile with aggregated data from all their sessions
  UPDATE public.profiles
  SET
    total_puffs = (
      SELECT COALESCE(SUM(puff_count), 0)
      FROM public.puff_sessions
      WHERE user_id = NEW.user_id OR (OLD.user_id IS NOT NULL AND user_id = OLD.user_id)
    ),
    total_smoke_earned = (
      SELECT COALESCE(SUM(smoke_earned), 0)
      FROM public.puff_sessions
      WHERE user_id = NEW.user_id OR (OLD.user_id IS NOT NULL AND user_id = OLD.user_id)
    ),
    last_active_date = CURRENT_DATE
  WHERE wallet_address = (
    SELECT user_id
    FROM public.puff_sessions
    WHERE id = COALESCE(NEW.id, OLD.id)
    LIMIT 1
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger to automatically sync profile totals when sessions change
DROP TRIGGER IF EXISTS sync_profile_totals ON public.puff_sessions;
CREATE TRIGGER sync_profile_totals
AFTER INSERT OR UPDATE OR DELETE ON public.puff_sessions
FOR EACH ROW
EXECUTE FUNCTION update_profile_totals();

-- 3. Manual sync for existing data (fix current users)
UPDATE public.profiles
SET
  total_puffs = (
    SELECT COALESCE(SUM(ps.puff_count), 0)
    FROM public.puff_sessions ps
    WHERE ps.user_id = profiles.wallet_address
  ),
  total_smoke_earned = (
    SELECT COALESCE(SUM(ps.smoke_earned), 0)
    FROM public.puff_sessions ps
    WHERE ps.user_id = profiles.wallet_address
  ),
  last_active_date = (
    SELECT DATE(MAX(ps.started_at))
    FROM public.puff_sessions ps
    WHERE ps.user_id = profiles.wallet_address
  )
WHERE wallet_address IN (
  SELECT DISTINCT user_id
  FROM public.puff_sessions
  WHERE user_id IS NOT NULL
);

-- 4. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_puff_sessions_user_id ON public.puff_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON public.profiles(wallet_address);