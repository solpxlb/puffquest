-- Fix confidence_score column precision to allow values 0-100
ALTER TABLE public.puff_events 
ALTER COLUMN confidence_score TYPE NUMERIC(5,2);

-- Add a check constraint to ensure confidence is between 0 and 100
ALTER TABLE public.puff_events
ADD CONSTRAINT confidence_score_range CHECK (confidence_score >= 0 AND confidence_score <= 100);