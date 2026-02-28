-- Add sp_attack column to monsters table
alter table monsters add column if not exists sp_attack integer not null default 50;

-- Add evolution_history to store previous stage snapshots
alter table monsters add column if not exists evolution_history jsonb not null default '[]'::jsonb;
