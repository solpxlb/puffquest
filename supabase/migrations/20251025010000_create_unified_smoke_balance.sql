-- ============================================
-- UNIFIED SMOKE BALANCE SYSTEM
-- ============================================
-- Create unified user_smoke_balance table to eliminate data redundancy
-- This replaces fragmented data across profiles, sessions, and calculations

-- 1. Create unified user_smoke_balance table
CREATE TABLE IF NOT EXISTS public.user_smoke_balance (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,

  -- Core balance information
  current_balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  total_claimed NUMERIC DEFAULT 0,
  total_puffs BIGINT DEFAULT 0,

  -- Device and progression data
  device_levels JSONB DEFAULT '{"vape": 0, "cigarette": 0, "cigar": 0}'::jsonb,
  last_passive_claim TIMESTAMPTZ,
  passive_accumulated NUMERIC DEFAULT 0,

  -- User engagement metrics
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata and timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on user_smoke_balance
ALTER TABLE public.user_smoke_balance ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for user_smoke_balance
CREATE POLICY "Users can view own balance"
ON public.user_smoke_balance
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = (
  SELECT email FROM auth.users WHERE raw_user_meta_data->>'address' = user_smoke_balance.user_id
));

CREATE POLICY "Users can insert own balance"
ON public.user_smoke_balance
FOR INSERT
TO authenticated
WITH CHECK (auth.jwt() ->> 'email' = (
  SELECT email FROM auth.users WHERE raw_user_meta_data->>'address' = user_smoke_balance.user_id
));

CREATE POLICY "Service roles can manage balances"
ON public.user_smoke_balance
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_smoke_balance_balance ON public.user_smoke_balance(current_balance DESC);
CREATE INDEX IF NOT EXISTS idx_user_smoke_balance_earned ON public.user_smoke_balance(total_earned DESC);
CREATE INDEX IF NOT EXISTS idx_user_smoke_balance_puffs ON public.user_smoke_balance(total_puffs DESC);
CREATE INDEX IF NOT EXISTS idx_user_smoke_balance_last_active ON public.user_smoke_balance(last_active_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_smoke_balance_updated ON public.user_smoke_balance(updated_at DESC);

-- 5. Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_smoke_balance_updated_at
BEFORE UPDATE ON public.user_smoke_balance
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 6. Data migration: Populate from existing sources
WITH profile_data AS (
  SELECT
    p.wallet_address,
    COALESCE(p.smoke_balance, 0) as current_balance,
    COALESCE(p.total_smoke_earned, 0) as total_earned,
    COALESCE(p.total_puffs, 0) as total_puffs,
    COALESCE(p.device_levels, '{"vape": 0, "cigarette": 0, "cigar": 0}'::jsonb) as device_levels,
    p.last_passive_claim,
    p.streak_days,
    p.last_active_date,
    p.created_at as first_seen_at
  FROM public.profiles p
  WHERE p.wallet_address IS NOT NULL AND p.wallet_address != ''
),
session_aggregates AS (
  SELECT
    ps.user_id,
    COALESCE(SUM(ps.puff_count), 0) as session_puffs,
    COALESCE(SUM(ps.smoke_earned), 0) as session_earned
  FROM public.puff_sessions ps
  WHERE ps.user_id IS NOT NULL
  GROUP BY ps.user_id
),
transaction_aggregates AS (
  SELECT
    st.user_id,
    COALESCE(SUM(CASE WHEN st.transaction_type = 'spend_upgrade' OR st.transaction_type = 'spend_other' THEN st.amount ELSE 0 END), 0) as total_spent,
    COALESCE(SUM(CASE WHEN st.transaction_type = 'claim' THEN st.amount ELSE 0 END), 0) as total_claimed
  FROM public.smoke_transactions st
  WHERE st.user_id IS NOT NULL
  GROUP BY st.user_id
),
merged_data AS (
  SELECT
    COALESCE(pd.wallet_address, sa.user_id, ta.user_id) as user_id,
    -- Use the highest values from different sources for data integrity
    GREATEST(
      COALESCE(pd.current_balance, 0),
      COALESCE(pd.total_earned, 0) - COALESCE(ta.total_spent, 0) - COALESCE(ta.total_claimed, 0),
      COALESCE(sa.session_earned, 0)
    ) as current_balance,
    GREATEST(
      COALESCE(pd.total_earned, 0),
      COALESCE(sa.session_earned, 0)
    ) as total_earned,
    COALESCE(ta.total_spent, 0) as total_spent,
    COALESCE(ta.total_claimed, 0) as total_claimed,
    GREATEST(
      COALESCE(pd.total_puffs, 0),
      COALESCE(sa.session_puffs, 0)
    ) as total_puffs,
    pd.device_levels,
    pd.last_passive_claim,
    pd.streak_days,
    pd.last_active_date,
    pd.first_seen_at
  FROM profile_data pd
  LEFT JOIN session_aggregates sa ON pd.wallet_address = sa.user_id
  LEFT JOIN transaction_aggregates ta ON pd.wallet_address = ta.user_id
)
INSERT INTO public.user_smoke_balance (
  user_id, current_balance, total_earned, total_spent, total_claimed,
  total_puffs, device_levels, last_passive_claim, streak_days,
  last_active_date, first_seen_at
)
SELECT
  user_id, current_balance, total_earned, total_spent, total_claimed,
  total_puffs, device_levels, last_passive_claim, streak_days,
  last_active_date, first_seen_at
FROM merged_data
ON CONFLICT (user_id)
DO UPDATE SET
  current_balance = GREATEST(user_smoke_balance.current_balance, EXCLUDED.current_balance),
  total_earned = GREATEST(user_smoke_balance.total_earned, EXCLUDED.total_earned),
  total_spent = GREATEST(user_smoke_balance.total_spent, EXCLUDED.total_spent),
  total_claimed = GREATEST(user_smoke_balance.total_claimed, EXCLUDED.total_claimed),
  total_puffs = GREATEST(user_smoke_balance.total_puffs, EXCLUDED.total_puffs),
  device_levels = COALESCE(EXCLUDED.device_levels, user_smoke_balance.device_levels),
  last_passive_claim = COALESCE(EXCLUDED.last_passive_claim, user_smoke_balance.last_passive_claim),
  streak_days = COALESCE(EXCLUDED.streak_days, user_smoke_balance.streak_days),
  last_active_date = COALESCE(EXCLUDED.last_active_date, user_smoke_balance.last_active_date),
  first_seen_at = LEAST(user_smoke_balance.first_seen_at, EXCLUDED.first_seen_at),
  updated_at = NOW();

-- 7. Add comments for documentation
COMMENT ON TABLE public.user_smoke_balance IS 'Unified table containing all $SMOKE-related user data. Eliminates redundancy across profiles, sessions, and calculations.';
COMMENT ON COLUMN public.user_smoke_balance.user_id IS 'Solana wallet address (base58 encoded)';
COMMENT ON COLUMN public.user_smoke_balance.current_balance IS 'Current available $SMOKE balance that can be claimed';
COMMENT ON COLUMN public.user_smoke_balance.total_earned IS 'Lifetime $SMOKE earned from all sources';
COMMENT ON COLUMN public.user_smoke_balance.total_spent IS 'Total $SMOKE spent on device upgrades';
COMMENT ON COLUMN public.user_smoke_balance.total_claimed IS 'Total $SMOKE claimed to external wallets';
COMMENT ON COLUMN public.user_smoke_balance.passive_accumulated IS 'Currently accumulated passive income (capped at 24 hours)';
COMMENT ON COLUMN public.user_smoke_balance.device_levels IS 'JSON object containing device levels: {"vape": X, "cigarette": Y, "cigar": Z}';