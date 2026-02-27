-- Run this in the Supabase SQL Editor to set up the database

-- Monsters table
create table if not exists monsters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  hp integer not null,
  attack integer not null,
  defense integer not null,
  speed integer not null,
  image_url text not null,
  created_at timestamptz default now()
);

-- Battles table
create table if not exists battles (
  id uuid default gen_random_uuid() primary key,
  winner_id uuid references monsters(id) on delete cascade,
  loser_id uuid references monsters(id) on delete cascade,
  created_at timestamptz default now()
);

-- Leaderboard view: top monsters by win count
create or replace view leaderboard as
select
  m.name as monster_name,
  m.image_url,
  count(b.id) as wins
from monsters m
inner join battles b on b.winner_id = m.id
group by m.id, m.name, m.image_url
order by wins desc
limit 10;

-- Storage bucket for monster images
insert into storage.buckets (id, name, public)
values ('monsters', 'monsters', true)
on conflict (id) do nothing;

-- Allow public read access to monster images
create policy "Public read access" on storage.objects
  for select using (bucket_id = 'monsters');

-- Allow anon inserts to monster images
create policy "Anon insert access" on storage.objects
  for insert with check (bucket_id = 'monsters');

-- RLS policies for monsters table
alter table monsters enable row level security;
create policy "Anyone can read monsters" on monsters for select using (true);
create policy "Anyone can insert monsters" on monsters for insert with check (true);

-- RLS policies for battles table
alter table battles enable row level security;
create policy "Anyone can read battles" on battles for select using (true);
create policy "Anyone can insert battles" on battles for insert with check (true);
