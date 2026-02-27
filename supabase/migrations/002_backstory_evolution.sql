-- Add backstory + evolution columns to monsters
ALTER TABLE monsters
  ADD COLUMN backstory TEXT DEFAULT '',
  ADD COLUMN stage INTEGER DEFAULT 1,
  ADD COLUMN evo_threshold_2 INTEGER,
  ADD COLUMN evo_threshold_3 INTEGER;

-- Index for counting wins per monster (used by evolution checks)
CREATE INDEX idx_battles_winner_id ON battles(winner_id);
