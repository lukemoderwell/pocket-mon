-- Add evolution_history column to store previous stage snapshots
alter table monsters add column if not exists evolution_history jsonb not null default '[]'::jsonb;
