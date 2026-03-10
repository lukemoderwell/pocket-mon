-- Add passive ability column to monsters
ALTER TABLE monsters
  ADD COLUMN IF NOT EXISTS passive TEXT DEFAULT NULL;
