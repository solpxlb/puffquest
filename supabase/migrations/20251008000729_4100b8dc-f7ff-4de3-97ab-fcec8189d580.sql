-- Update the handle_new_user function to properly extract wallet address from Solana Web3 auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, wallet_address)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'address',
      NEW.raw_user_meta_data->>'wallet_address',
      NEW.email,
      ''
    )
  );
  RETURN NEW;
END;
$$;