-- Fix RLS policies for invite_codes to use correct JWT structure
-- The issue: auth.jwt() ->> 'address' doesn't work with Supabase Web3 auth
-- Solution: Use raw_app_meta_data->>'provider_id' which contains the wallet address

-- First, drop the existing problematic policies
DROP POLICY IF EXISTS "Admin can manage all invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Users can view their created codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Users can view codes they used" ON public.invite_codes;
DROP POLICY IF EXISTS "Users can view their own profile access status" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

-- Create a helper function to get the wallet address from the current user's JWT
CREATE OR REPLACE FUNCTION public.get_current_wallet_address()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- For Solana Web3 auth, the wallet address is stored in raw_app_meta_data
    (SELECT raw_app_meta_data->>'provider_id' FROM auth.users WHERE id = auth.uid()),
    -- Fallback to user_meta_data paths
    (SELECT raw_user_meta_data->>'address' FROM auth.users WHERE id = auth.uid()),
    (SELECT raw_user_meta_data->>'wallet_address' FROM auth.users WHERE id = auth.uid()),
    -- Finally check the wallet_address in profiles table
    (SELECT wallet_address FROM public.profiles WHERE id = auth.uid())
  );
$$;

-- RLS Policies for invite_codes table
-- Admin wallet can do everything
CREATE POLICY "Admin can manage all invite codes"
ON public.invite_codes
FOR ALL
TO authenticated
USING (
  get_current_wallet_address() = '2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw'
  OR created_by = get_current_wallet_address()
);

-- Users can view codes they created
CREATE POLICY "Users can view their created codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (created_by = get_current_wallet_address());

-- Users can view codes they used
CREATE POLICY "Users can view codes they used"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (used_by = get_current_wallet_address());

-- RLS policies for profiles to allow access status checks
CREATE POLICY "Users can view their own profile access status"
ON public.profiles
FOR SELECT
TO authenticated
USING (wallet_address = get_current_wallet_address());

-- Admin can view all profiles
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (get_current_wallet_address() = '2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw');

-- Comment the function
COMMENT ON FUNCTION public.get_current_wallet_address() IS 'Helper function to extract wallet address from Supabase Web3 JWT token structure';
