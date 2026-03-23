-- Add elemental types to monsters (1-2 types per monster)
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS types JSONB DEFAULT '["normal"]';
