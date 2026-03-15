-- Add body_type and weight columns to monsters
ALTER TABLE monsters
  ADD COLUMN IF NOT EXISTS body_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight REAL DEFAULT NULL;
