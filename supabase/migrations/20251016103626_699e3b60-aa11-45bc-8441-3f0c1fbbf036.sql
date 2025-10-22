-- ============================================
-- PHASE 1A: DATABASE FOUNDATION
-- ============================================

-- 1. Update profiles table with new economy columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS smoke_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_earned BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_smoke_earned NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_passive_claim TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_date DATE,
ADD COLUMN IF NOT EXISTS total_puffs BIGINT DEFAULT 0;

-- 2. Create global_stats singleton table
CREATE TABLE IF NOT EXISTS public.global_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_players BIGINT DEFAULT 0,
  total_points_distributed BIGINT DEFAULT 0,
  total_smoke_distributed NUMERIC DEFAULT 0,
  rewards_pool_remaining NUMERIC DEFAULT 45000000,
  circulating_supply NUMERIC DEFAULT 40000000,
  team_allocation NUMERIC DEFAULT 5000000,
  current_conversion_rate NUMERIC DEFAULT 10000,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert initial global stats
INSERT INTO public.global_stats (id, total_players, rewards_pool_remaining, circulating_supply, team_allocation, current_conversion_rate)
VALUES (1, 0, 45000000, 40000000, 5000000, 10000)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on global_stats
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read global stats
CREATE POLICY "Anyone can view global stats"
ON public.global_stats
FOR SELECT
TO authenticated
USING (true);

-- 3. Create smoke_transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.smoke_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earn_puff', 'earn_passive', 'convert', 'spend_upgrade', 'spend_other'
  amount NUMERIC NOT NULL,
  points_converted BIGINT,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on smoke_transactions
ALTER TABLE public.smoke_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.smoke_transactions
FOR SELECT
TO authenticated
USING (true);

-- Anyone can insert transactions (edge functions will handle this)
CREATE POLICY "Anyone can insert transactions"
ON public.smoke_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smoke_transactions_user_id ON public.smoke_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smoke_transactions_type ON public.smoke_transactions(transaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_smoke_balance ON public.profiles(smoke_balance DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_total_points ON public.profiles(total_points_earned DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_date DESC);