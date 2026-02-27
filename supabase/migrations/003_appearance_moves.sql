-- Add appearance + moves columns to monsters
ALTER TABLE monsters
  ADD COLUMN IF NOT EXISTS appearance TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moves JSONB DEFAULT '[]';
