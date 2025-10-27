-- Grandfather existing users who have made vice purchases
-- Auto-approve admin wallet and all users with purchase history

-- 1. Approve admin wallet
UPDATE public.profiles
SET
  access_status = 'approved',
  approved_at = now()
WHERE wallet_address = '2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw';

-- 2. Approve all users who have purchased vices (use wallet_address not id)
UPDATE public.profiles
SET
  access_status = 'approved',
  approved_at = now()
WHERE wallet_address IN (
  SELECT DISTINCT user_id
  FROM public.vice_purchases
  WHERE status = 'confirmed'
)
AND access_status != 'approved'; -- Only update if not already approved

-- 3. Log the grandfathering for audit trail
DO $$
DECLARE
  approved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO approved_count
  FROM public.profiles
  WHERE access_status = 'approved';

  RAISE NOTICE 'Grandfathered % existing users with approved access', approved_count;
END $$;
