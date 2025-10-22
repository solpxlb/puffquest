-- Update existing profile with correct wallet address
UPDATE public.profiles
SET wallet_address = 'D17tTaN8XxWuYLsHcCLTt86RJMXpGDMSMoiWuyASkC7M'
WHERE id = '2277206f-c8b4-4d6e-8377-92f2f9463492'::uuid
  AND (wallet_address IS NULL OR wallet_address = '');

-- Update handle_new_user() to correctly extract Web3 wallet addresses
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, wallet_address)
  VALUES (
    NEW.id,
    COALESCE(
      -- For Solana Web3 auth, the wallet address is stored in raw_app_meta_data
      NEW.raw_app_meta_data->>'provider_id',
      -- Fallback to user_meta_data paths
      NEW.raw_user_meta_data->>'address',
      NEW.raw_user_meta_data->>'wallet_address',
      NEW.email,
      ''
    )
  );
  RETURN NEW;
END;
$function$;