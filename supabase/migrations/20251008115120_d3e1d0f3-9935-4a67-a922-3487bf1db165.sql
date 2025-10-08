-- Update handle_new_user to correctly extract Solana wallet address and make it idempotent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addr text;
BEGIN
  addr := COALESCE(
    -- Preferred: custom_claims.address from Web3 sign-in
    NEW.raw_user_meta_data->'custom_claims'->>'address',
    -- Other common metadata locations
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'wallet_address',
    -- app meta provider_id sometimes stores the wallet
    NEW.raw_app_meta_data->>'provider_id',
    -- sub might be like 'web3:solana:<address>'
    NULLIF(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'sub',''), '^web3:solana:', ''), ''),
    -- Fallback to email or empty
    NEW.email,
    ''
  );

  INSERT INTO public.profiles (id, wallet_address)
  VALUES (NEW.id, addr)
  ON CONFLICT (id)
  DO UPDATE
  SET wallet_address =
    CASE
      WHEN (public.profiles.wallet_address IS NULL OR public.profiles.wallet_address = '')
        AND EXCLUDED.wallet_address IS NOT NULL AND EXCLUDED.wallet_address <> ''
      THEN EXCLUDED.wallet_address
      ELSE public.profiles.wallet_address
    END;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists to call handle_new_user on new signups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Backfill: populate wallet_address for existing profiles that are empty
WITH source AS (
  SELECT
    u.id,
    COALESCE(
      u.raw_user_meta_data->'custom_claims'->>'address',
      u.raw_user_meta_data->>'address',
      u.raw_user_meta_data->>'wallet_address',
      u.raw_app_meta_data->>'provider_id',
      NULLIF(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'sub',''), '^web3:solana:', ''), ''),
      u.email,
      ''
    ) AS addr
  FROM auth.users u
)
UPDATE public.profiles p
SET wallet_address = s.addr
FROM source s
WHERE p.id = s.id
  AND (p.wallet_address IS NULL OR btrim(p.wallet_address) = '')
  AND btrim(COALESCE(s.addr, '')) <> '';

-- Insert missing profile rows for users who signed up before the trigger existed
WITH source AS (
  SELECT
    u.id,
    COALESCE(
      u.raw_user_meta_data->'custom_claims'->>'address',
      u.raw_user_meta_data->>'address',
      u.raw_user_meta_data->>'wallet_address',
      u.raw_app_meta_data->>'provider_id',
      NULLIF(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'sub',''), '^web3:solana:', ''), ''),
      u.email,
      ''
    ) AS addr
  FROM auth.users u
)
INSERT INTO public.profiles (id, wallet_address)
SELECT s.id, s.addr
FROM source s
LEFT JOIN public.profiles p ON p.id = s.id
WHERE p.id IS NULL;