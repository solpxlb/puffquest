-- ============================================
-- BALANCE MANAGEMENT TRIGGERS AND FUNCTIONS
-- ============================================
-- Create automated triggers to maintain unified balance consistency

-- 1. Function to record balance changes in transactions table
CREATE OR REPLACE FUNCTION public.record_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_balance NUMERIC;
  new_balance NUMERIC;
  change_amount NUMERIC;
  transaction_type TEXT;
BEGIN
  -- Get old and new balances
  old_balance := COALESCE(OLD.current_balance, 0);
  new_balance := COALESCE(NEW.current_balance, 0);
  change_amount := new_balance - old_balance;

  -- Skip if no change in balance
  IF change_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Determine transaction type based on balance change direction
  IF change_amount > 0 THEN
    transaction_type := 'earn';
  ELSE
    transaction_type := 'spend_other';
    change_amount := ABS(change_amount);
  END IF;

  -- Insert transaction record
  INSERT INTO public.smoke_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    metadata,
    created_at
  ) VALUES (
    NEW.user_id,
    transaction_type,
    change_amount,
    old_balance,
    new_balance,
    jsonb_build_object(
      'trigger', 'balance_update',
      'old_balance', old_balance,
      'new_balance', new_balance,
      'change_amount', change_amount
    ),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    INSERT INTO public.smoke_transactions (
      user_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      metadata,
      created_at
    ) VALUES (
      NEW.user_id,
      'error',
      0,
      old_balance,
      new_balance,
      jsonb_build_object(
        'trigger', 'balance_update_error',
        'error', SQLERRM
      ),
      NOW()
    );

    RETURN NEW;
END;
$$;

-- 2. Function to update total_earned when balance increases
CREATE OR REPLACE FUNCTION public.update_total_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If current_balance increased, update total_earned if needed
  IF NEW.current_balance > OLD.current_balance THEN
    NEW.total_earned := GREATEST(
      NEW.total_earned,
      OLD.total_earned + (NEW.current_balance - OLD.current_balance)
    );
  END IF;

  -- Update updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

-- 3. Function to handle device upgrade spending
CREATE OR REPLACE FUNCTION public.record_upgrade_spend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upgrade_cost NUMERIC;
  device_type TEXT;
  old_level INTEGER;
  new_level INTEGER;
BEGIN
  -- Check if device_levels changed (upgrade happened)
  IF NEW.device_levels IS DISTINCT FROM OLD.device_levels THEN
    -- Calculate upgrade cost (this should match GameEconomy.getUpgradeCost)
    -- We'll need to determine which device was upgraded
    IF (NEW.device_levels->>'vape')::INTEGER > (OLD.device_levels->>'vape')::INTEGER THEN
      device_type := 'vape';
      old_level := (OLD.device_levels->>'vape')::INTEGER;
      new_level := (NEW.device_levels->>'vape')::INTEGER;
    ELSIF (NEW.device_levels->>'cigarette')::INTEGER > (OLD.device_levels->>'cigarette')::INTEGER THEN
      device_type := 'cigarette';
      old_level := (OLD.device_levels->>'cigarette')::INTEGER;
      new_level := (NEW.device_levels->>'cigarette')::INTEGER;
    ELSIF (NEW.device_levels->>'cigar')::INTEGER > (OLD.device_levels->>'cigar')::INTEGER THEN
      device_type := 'cigar';
      old_level := (OLD.device_levels->>'cigar')::INTEGER;
      new_level := (NEW.device_levels->>'cigar')::INTEGER;
    END IF;

    -- Calculate upgrade cost using the same formula as GameEconomy
    IF old_level > 0 AND old_level < 10 THEN
      upgrade_cost := 500 * POWER(2, old_level - 1);

      -- Update total_spent
      NEW.total_spent := OLD.total_spent + upgrade_cost;

      -- Record the transaction
      INSERT INTO public.smoke_transactions (
        user_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        metadata,
        created_at
      ) VALUES (
        NEW.user_id,
        'spend_upgrade',
        upgrade_cost,
        OLD.current_balance,
        NEW.current_balance,
        jsonb_build_object(
          'device_type', device_type,
          'old_level', old_level,
          'new_level', new_level,
          'cost', upgrade_cost
        ),
        NOW()
      );
    END IF;
  END IF;

  -- Update updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

-- 4. Function to create user_smoke_balance record when profile is created
CREATE OR REPLACE FUNCTION public.create_user_balance_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create corresponding user_smoke_balance record
  INSERT INTO public.user_smoke_balance (
    user_id,
    current_balance,
    total_earned,
    total_spent,
    total_claimed,
    total_puffs,
    device_levels,
    streak_days,
    last_active_date,
    first_seen_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.wallet_address,
    COALESCE(NEW.smoke_balance, 0),
    COALESCE(NEW.total_smoke_earned, 0),
    0,
    0,
    COALESCE(NEW.total_puffs, 0),
    COALESCE(NEW.device_levels, '{"vape": 0, "cigarette": 0, "cigar": 0}'::jsonb),
    COALESCE(NEW.streak_days, 0),
    NEW.last_active_date,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Create triggers

-- Balance change recording trigger
DROP TRIGGER IF EXISTS tr_balance_change ON public.user_smoke_balance;
CREATE TRIGGER tr_balance_change
  AFTER UPDATE ON public.user_smoke_balance
  FOR EACH ROW
  WHEN (OLD.current_balance IS DISTINCT FROM NEW.current_balance)
  EXECUTE FUNCTION public.record_balance_change();

-- Total earned update trigger
DROP TRIGGER IF EXISTS tr_update_total_earned ON public.user_smoke_balance;
CREATE TRIGGER tr_update_total_earned
  BEFORE UPDATE ON public.user_smoke_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_total_earned();

-- Device upgrade spending trigger
DROP TRIGGER IF EXISTS tr_record_upgrade_spend ON public.user_smoke_balance;
CREATE TRIGGER tr_record_upgrade_spend
  BEFORE UPDATE ON public.user_smoke_balance
  FOR EACH ROW
  WHEN (OLD.device_levels IS DISTINCT FROM NEW.device_levels)
  EXECUTE FUNCTION public.record_upgrade_spend();

-- Profile to balance sync trigger
DROP TRIGGER IF EXISTS tr_create_user_balance_on_profile ON public.profiles;
CREATE TRIGGER tr_create_user_balance_on_profile
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.wallet_address IS NOT NULL AND NEW.wallet_address != '')
  EXECUTE FUNCTION public.create_user_balance_on_profile();

-- 6. Function to sync existing profiles to user_smoke_balance
CREATE OR REPLACE FUNCTION public.sync_existing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user_smoke_balance records for any profiles that don't have them
  INSERT INTO public.user_smoke_balance (
    user_id,
    current_balance,
    total_earned,
    total_spent,
    total_claimed,
    total_puffs,
    device_levels,
    last_passive_claim,
    streak_days,
    last_active_date,
    first_seen_at,
    created_at,
    updated_at
  )
  SELECT
    p.wallet_address,
    COALESCE(p.smoke_balance, 0),
    COALESCE(p.total_smoke_earned, 0),
    0,
    0,
    COALESCE(p.total_puffs, 0),
    COALESCE(p.device_levels, '{"vape": 0, "cigarette": 0, "cigar": 0}'::jsonb),
    p.last_passive_claim,
    COALESCE(p.streak_days, 0),
    p.last_active_date,
    NOW(),
    NOW(),
    NOW()
  FROM public.profiles p
  WHERE p.wallet_address IS NOT NULL
    AND p.wallet_address != ''
    AND NOT EXISTS (
      SELECT 1 FROM public.user_smoke_balance usb
      WHERE usb.user_id = p.wallet_address
    );

  -- Update timestamp
  RAISE NOTICE 'Synced existing profiles to user_smoke_balance table';
END;
$$;

-- 7. Run the sync function
SELECT public.sync_existing_profiles();

-- 8. Add comments for documentation
COMMENT ON FUNCTION public.record_balance_change() IS 'Records balance changes in smoke_transactions table for audit trail';
COMMENT ON FUNCTION public.update_total_earned() IS 'Updates total_earned when current_balance increases';
COMMENT ON FUNCTION public.record_upgrade_spend() IS 'Records device upgrade spending and updates total_spent';
COMMENT ON FUNCTION public.create_user_balance_on_profile() IS 'Creates user_smoke_balance record when profile is created/updated';
COMMENT ON FUNCTION public.sync_existing_profiles() IS 'One-time sync of existing profiles to unified balance table';