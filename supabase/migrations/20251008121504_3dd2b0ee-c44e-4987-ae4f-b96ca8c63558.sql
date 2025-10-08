-- Add device_levels column to profiles table
ALTER TABLE public.profiles
ADD COLUMN device_levels JSONB NOT NULL DEFAULT '{"vape": 0, "cigarette": 0, "cigar": 0}'::jsonb;