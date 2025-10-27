-- Create invite_codes table for managing invite code generation and redemption
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Add access control columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'pending' CHECK (access_status IN ('approved', 'waitlist', 'pending')),
ADD COLUMN IF NOT EXISTS invite_code_used TEXT REFERENCES public.invite_codes(code),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by ON public.invite_codes(used_by);
CREATE INDEX IF NOT EXISTS idx_profiles_access_status ON public.profiles(access_status);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON public.profiles(wallet_address);

-- Enable RLS on invite_codes table
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invite_codes
-- Admin wallet can do everything
CREATE POLICY "Admin can manage all invite codes"
ON public.invite_codes
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'address' = '2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw'
  OR created_by = (auth.jwt() ->> 'address')
);

-- Users can view codes they created
CREATE POLICY "Users can view their created codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (created_by = (auth.jwt() ->> 'address'));

-- Users can view codes they used
CREATE POLICY "Users can view codes they used"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (used_by = (auth.jwt() ->> 'address'));

-- Update RLS policies for profiles to allow access status checks
CREATE POLICY "Users can view their own profile access status"
ON public.profiles
FOR SELECT
TO authenticated
USING (wallet_address = (auth.jwt() ->> 'address'));

-- Admin can view all profiles
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'address' = '2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw');

-- Function to generate random invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  characters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed ambiguous chars like 0, O, 1, I
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(characters, floor(random() * length(characters) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Comment on table
COMMENT ON TABLE public.invite_codes IS 'Stores invite codes for access control. Single-use codes that grant approved access to the platform.';
COMMENT ON COLUMN public.profiles.access_status IS 'User access status: pending (default), approved (can access app), waitlist (future use)';
