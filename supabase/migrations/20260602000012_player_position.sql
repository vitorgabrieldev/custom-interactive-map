-- Add last known position columns to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
