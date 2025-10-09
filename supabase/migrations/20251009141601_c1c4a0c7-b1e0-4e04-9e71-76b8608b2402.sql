-- Add AI detection metric columns to puff_events table
ALTER TABLE puff_events
ADD COLUMN mouth_height NUMERIC,
ADD COLUMN mouth_width NUMERIC,
ADD COLUMN aspect_ratio NUMERIC,
ADD COLUMN lip_pursing NUMERIC,
ADD COLUMN cheek_puff NUMERIC,
ADD COLUMN mouth_pucker NUMERIC,
ADD COLUMN jaw_open NUMERIC,
ADD COLUMN max_aspect_ratio NUMERIC,
ADD COLUMN max_pursing NUMERIC,
ADD COLUMN max_cheek_puff NUMERIC,
ADD COLUMN max_mouth_pucker NUMERIC,
ADD COLUMN sequence_score INTEGER,
ADD COLUMN detection_reason TEXT,
ADD COLUMN points_awarded INTEGER DEFAULT 20;

-- Make confidence_score required with default
ALTER TABLE puff_events
ALTER COLUMN confidence_score SET DEFAULT 0,
ALTER COLUMN confidence_score SET NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE puff_events IS 'Stores individual puff detection events with AI metrics from MediaPipe facial landmark analysis';