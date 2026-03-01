-- Add sp_attack column to monsters table
alter table monsters add column if not exists sp_attack integer not null default 50;
