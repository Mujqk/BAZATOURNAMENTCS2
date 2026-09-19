-- Migration: Add team_join_requests table and backfill columns on lfg_requests

alter table public.lfg_requests
  add column if not exists steam_id text,
  add column if not exists faceit_elo int,
  add column if not exists faceit_level int;

create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('invite', 'application')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  nickname text not null,
  steam_id text not null,
  faceit_elo int,
  faceit_level int,
  role text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists idx_team_join_requests_team on public.team_join_requests(team_id);
create index if not exists idx_team_join_requests_user on public.team_join_requests(user_id);
create index if not exists idx_team_join_requests_tourn on public.team_join_requests(tournament_id);

-- Enable RLS
alter table public.team_join_requests enable row level security;

-- Policies
drop policy if exists "team_join_requests_select" on public.team_join_requests;
create policy "team_join_requests_select" on public.team_join_requests
  for select using (true);

drop policy if exists "team_join_requests_insert" on public.team_join_requests;
create policy "team_join_requests_insert" on public.team_join_requests
  for insert with check (auth.uid() is not null);

drop policy if exists "team_join_requests_update" on public.team_join_requests;
create policy "team_join_requests_update" on public.team_join_requests
  for update using (auth.uid() is not null);

drop policy if exists "team_join_requests_delete" on public.team_join_requests;
create policy "team_join_requests_delete" on public.team_join_requests
  for delete using (auth.uid() is not null);
