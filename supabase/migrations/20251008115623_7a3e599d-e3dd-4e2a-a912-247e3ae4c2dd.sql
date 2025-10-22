-- Create puff_sessions table to track user smoking sessions
CREATE TABLE public.puff_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  puff_count INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create puff_events table for detailed tracking of individual puffs
CREATE TABLE public.puff_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.puff_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on puff_sessions
ALTER TABLE public.puff_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on puff_events
ALTER TABLE public.puff_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for puff_sessions
CREATE POLICY "Users can view own sessions"
ON public.puff_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
ON public.puff_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.puff_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
ON public.puff_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for puff_events
CREATE POLICY "Users can view own puff events"
ON public.puff_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own puff events"
ON public.puff_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_puff_sessions_user_id ON public.puff_sessions(user_id);
CREATE INDEX idx_puff_sessions_started_at ON public.puff_sessions(started_at DESC);
CREATE INDEX idx_puff_events_session_id ON public.puff_events(session_id);
CREATE INDEX idx_puff_events_user_id ON public.puff_events(user_id);

-- Add trigger for automatic timestamp updates on puff_sessions
CREATE TRIGGER update_puff_sessions_updated_at
BEFORE UPDATE ON public.puff_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();