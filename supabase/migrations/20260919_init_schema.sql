-- ==============================================================================
-- CS2 Community Tournament Platform Database Schema
-- Supabase Postgres Migration
-- Includes: Tables, Constraints, Indexes, Triggers, RLS, and Atomic RPCs
-- ==============================================================================

-- 1. PROFILES TABLE
-- Stores Discord-authenticated users, synced with auth.users via trigger.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique not null,
  discord_username text not null,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_is_admin on public.profiles(id) where is_admin = true;
create index if not exists idx_profiles_discord_id on public.profiles(discord_id);

-- Protect is_admin flag from being edited via normal client API calls
create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.is_admin is distinct from old.is_admin) and (auth.role() = 'authenticated') then
    raise exception 'Modifying is_admin directly through client API is forbidden.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_admin on public.profiles;
create trigger trg_protect_profile_admin
  before update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

-- Automatic trigger for user creation on Discord OAuth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_discord_id text;
  raw_username text;
  raw_avatar text;
begin
  raw_discord_id := coalesce(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub',
    new.id::text
  );

  -- Safely extract Discord username (single arrow -> for nested JSON object)
  raw_username := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->'custom_claims'->>'global_name',
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    'CS2 Player'
  );

  if raw_username is null or trim(raw_username) = '' then
    raw_username := 'CS2 Player';
  end if;

  raw_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  insert into public.profiles (id, discord_id, discord_username, avatar_url, is_admin)
  values (new.id, raw_discord_id, raw_username, raw_avatar, false)
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    discord_username = excluded.discord_username,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
exception when others then
  raise warning 'Error in handle_new_user: %', SQLERRM;
  begin
    insert into public.profiles (id, discord_id, discord_username, avatar_url, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub', new.id::text),
      'CS2 Player',
      null,
      false
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'Fallback also failed in handle_new_user: %', SQLERRM;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. TOURNAMENTS TABLE
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) >= 3),
  description text,
  format text not null check (format in ('1x1', '2x2', '5x5')),
  bracket_size int not null check (bracket_size in (4, 8, 16, 32)),
  registration_start timestamptz not null,
  tournament_start timestamptz not null check (tournament_start > registration_start),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_tournaments_status on public.tournaments(status);
create index if not exists idx_tournaments_start on public.tournaments(tournament_start);


-- 3. TEAMS TABLE
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text,
  captain_id uuid not null references public.profiles(id),
  bracket_position int check (bracket_position > 0),
  created_at timestamptz not null default now(),
  constraint uq_captain_per_tournament unique (tournament_id, captain_id)
);

create index if not exists idx_teams_tournament on public.teams(tournament_id);


-- 4. TEAM MEMBERS TABLE
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  steam_id text not null check (steam_id ~ '^[0-9]{17}$'),
  faceit_nickname text,
  faceit_level int check (faceit_level between 1 and 10),
  faceit_elo int check (faceit_elo >= 0),
  is_captain boolean not null default false,
  constraint uq_steam_per_team unique (team_id, steam_id)
);

create index if not exists idx_team_members_team on public.team_members(team_id);
create index if not exists idx_team_members_steam on public.team_members(steam_id);


-- 5. MATCHES TABLE (Single Elimination Bracket)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round int not null check (round > 0),
  position_in_round int not null check (position_in_round > 0),
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  score_a int default 0,
  score_b int default 0,
  winner_id uuid references public.teams(id) on delete set null,
  next_match_id uuid references public.matches(id) on delete set null,
  constraint uq_match_position unique (tournament_id, round, position_in_round)
);

create index if not exists idx_matches_tournament on public.matches(tournament_id);
create index if not exists idx_matches_round on public.matches(tournament_id, round);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.matches enable row level security;

-- Admin check helper function (SECURITY DEFINER, stable)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- PROFILES POLICIES
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- TOURNAMENTS POLICIES
drop policy if exists "tournaments_select_public" on public.tournaments;
create policy "tournaments_select_public" on public.tournaments
  for select using (true);

drop policy if exists "tournaments_insert_admin" on public.tournaments;
create policy "tournaments_insert_admin" on public.tournaments
  for insert with check (public.is_admin());

drop policy if exists "tournaments_update_admin" on public.tournaments;
create policy "tournaments_update_admin" on public.tournaments
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tournaments_delete_admin" on public.tournaments;
create policy "tournaments_delete_admin" on public.tournaments
  for delete using (public.is_admin());


-- TEAMS POLICIES
drop policy if exists "teams_select_public" on public.teams;
create policy "teams_select_public" on public.teams
  for select using (true);

drop policy if exists "teams_insert_open_tournament" on public.teams;
create policy "teams_insert_open_tournament" on public.teams
  for insert with check (
    auth.uid() = captain_id
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status in ('upcoming', 'registration_open')
    )
  );

drop policy if exists "teams_update_captain_or_admin" on public.teams;
create policy "teams_update_captain_or_admin" on public.teams
  for update using (
    (captain_id = auth.uid() and exists (
      select 1 from public.tournaments t where t.id = tournament_id and t.status in ('upcoming', 'registration_open')
    )) or public.is_admin()
  );

drop policy if exists "teams_delete_captain_or_admin" on public.teams;
create policy "teams_delete_captain_or_admin" on public.teams
  for delete using (
    (captain_id = auth.uid() and exists (
      select 1 from public.tournaments t where t.id = tournament_id and t.status in ('upcoming', 'registration_open')
    )) or public.is_admin()
  );


-- TEAM MEMBERS POLICIES
drop policy if exists "team_members_select_public" on public.team_members;
create policy "team_members_select_public" on public.team_members
  for select using (true);

drop policy if exists "team_members_insert_captain" on public.team_members;
create policy "team_members_insert_captain" on public.team_members
  for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id and (t.captain_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "team_members_delete_captain_or_admin" on public.team_members;
create policy "team_members_delete_captain_or_admin" on public.team_members
  for delete using (
    exists (
      select 1 from public.teams t
      join public.tournaments tour on tour.id = t.tournament_id
      where t.id = team_members.team_id
        and ((t.captain_id = auth.uid() and tour.status in ('upcoming', 'registration_open')) or public.is_admin())
    )
  );


-- MATCHES POLICIES
drop policy if exists "matches_select_public" on public.matches;
create policy "matches_select_public" on public.matches
  for select using (true);

drop policy if exists "matches_write_admin" on public.matches;
create policy "matches_write_admin" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());


-- ==============================================================================
-- STORED PROCEDURES (RPC) FOR ATOMIC OPERATIONS
-- ==============================================================================

-- 1. ATOMIC TEAM REGISTRATION WITH ROW LOCKING (Fixes race conditions)
create or replace function public.register_team_atomic(
  p_tournament_id uuid,
  p_team_name text,
  p_members jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournament record;
  v_team_count int;
  v_team_id uuid;
  v_member jsonb;
  v_required_members int;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Please login via Discord first.';
  end if;

  -- Lock the tournament row to prevent concurrent race conditions
  select id, status, format, bracket_size, registration_start, tournament_start
  into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if now() < v_tournament.registration_start then
    raise exception 'Registration has not started yet';
  end if;

  if v_tournament.status not in ('upcoming', 'registration_open') then
    raise exception 'Registration is closed for this tournament';
  end if;

  if exists (select 1 from public.teams where tournament_id = p_tournament_id and captain_id = auth.uid()) then
    raise exception 'You have already registered a team for this tournament';
  end if;

  v_required_members := case v_tournament.format
    when '1x1' then 1
    when '2x2' then 2
    when '5x5' then 5
    else 1
  end;

  if jsonb_array_length(p_members) < 1 or jsonb_array_length(p_members) > v_required_members then
    raise exception 'Invalid number of members: expected between 1 and %, got %',
      v_required_members, jsonb_array_length(p_members);
  end if;

  select count(*) into v_team_count from public.teams where tournament_id = p_tournament_id;

  if v_team_count >= v_tournament.bracket_size then
    update public.tournaments set status = 'registration_closed' where id = p_tournament_id;
    raise exception 'Tournament slots are already completely filled';
  end if;

  -- Create team
  insert into public.teams (tournament_id, name, captain_id)
  values (p_tournament_id, nullif(trim(p_team_name), ''), auth.uid())
  returning id into v_team_id;

  -- Insert members
  for v_member in select * from jsonb_array_elements(p_members)
  loop
    insert into public.team_members (team_id, steam_id, faceit_nickname, faceit_level, faceit_elo, is_captain)
    values (
      v_team_id,
      v_member->>'steam_id',
      v_member->>'faceit_nickname',
      (v_member->>'faceit_level')::int,
      (v_member->>'faceit_elo')::int,
      coalesce((v_member->>'is_captain')::boolean, false)
    );
  end loop;

  -- Check if slot reached capacity
  if v_team_count + 1 >= v_tournament.bracket_size then
    update public.tournaments set status = 'registration_closed' where id = p_tournament_id;
  elsif v_tournament.status = 'upcoming' then
    update public.tournaments set status = 'registration_open' where id = p_tournament_id;
  end if;

  return v_team_id;
end;
$$;


-- 2. GENERATE BRACKET TREE & SEEDING (Admin only)
create or replace function public.generate_bracket(
  p_tournament_id uuid,
  p_seed_type text default 'random'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bracket_size int;
  v_total_rounds int;
  v_round int;
  v_match_in_round int;
  v_num_matches int;
  v_teams uuid[];
  v_team_count int;
  v_team_a uuid;
  v_team_b uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can generate brackets';
  end if;

  select bracket_size into v_bracket_size from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  -- Delete existing matches for fresh tree
  delete from public.matches where tournament_id = p_tournament_id;

  -- Collect teams
  if p_seed_type = 'random' then
    select coalesce(array_agg(id order by random()), '{}'::uuid[]) into v_teams
    from public.teams where tournament_id = p_tournament_id;
  else
    -- Seed by average team Faceit ELO
    select coalesce(array_agg(t.id order by coalesce(avg(tm.faceit_elo), 0) desc), '{}'::uuid[])
    into v_teams
    from public.teams t
    left join public.team_members tm on tm.team_id = t.id
    where t.tournament_id = p_tournament_id
    group by t.id;
  end if;

  v_team_count := coalesce(array_length(v_teams, 1), 0);

  -- Assign bracket_position to each team
  for i in 1..v_team_count loop
    update public.teams set bracket_position = i where id = v_teams[i];
  end loop;

  -- Calculate rounds: 4 -> 2 rounds, 8 -> 3 rounds, 16 -> 4 rounds, 32 -> 5 rounds
  v_total_rounds := ceil(log(2, v_bracket_size))::int;

  -- 1. Create empty match nodes from final (round v_total_rounds) down to round 1
  for v_round in reverse v_total_rounds..1 loop
    v_num_matches := power(2, v_total_rounds - v_round)::int;
    for v_match_in_round in 1..v_num_matches loop
      insert into public.matches (tournament_id, round, position_in_round)
      values (p_tournament_id, v_round, v_match_in_round);
    end loop;
  end loop;

  -- 2. Link next_match_id: winner of (round, pos) goes to (round+1, ceil(pos/2))
  update public.matches m
  set next_match_id = parent.id
  from public.matches parent
  where parent.tournament_id = m.tournament_id
    and parent.round = m.round + 1
    and parent.position_in_round = ceil(m.position_in_round::float / 2);

  -- 3. Populate Round 1 matches with seeded teams
  for v_match_in_round in 1..(v_bracket_size / 2) loop
    v_team_a := null;
    v_team_b := null;

    if (v_match_in_round * 2 - 1) <= v_team_count then
      v_team_a := v_teams[v_match_in_round * 2 - 1];
    end if;

    if (v_match_in_round * 2) <= v_team_count then
      v_team_b := v_teams[v_match_in_round * 2];
    end if;

    update public.matches
    set team_a_id = v_team_a,
        team_b_id = v_team_b
    where tournament_id = p_tournament_id
      and round = 1
      and position_in_round = v_match_in_round;

    -- Handle BYE auto-pass if only team_a is present and no team_b
    if v_team_a is not null and v_team_b is null and v_total_rounds > 1 then
      update public.matches
      set winner_id = v_team_a, score_a = 1, score_b = 0
      where tournament_id = p_tournament_id and round = 1 and position_in_round = v_match_in_round;

      -- Advance team_a immediately to round 2
      if (v_match_in_round % 2) = 1 then
        update public.matches set team_a_id = v_team_a
        where id = (select next_match_id from public.matches where tournament_id = p_tournament_id and round = 1 and position_in_round = v_match_in_round);
      else
        update public.matches set team_b_id = v_team_a
        where id = (select next_match_id from public.matches where tournament_id = p_tournament_id and round = 1 and position_in_round = v_match_in_round);
      end if;
    end if;
  end loop;

  -- Set tournament status to in_progress
  update public.tournaments set status = 'in_progress' where id = p_tournament_id;
end;
$$;


-- 3. ADVANCE MATCH WINNER & SCORE (Admin only)
create or replace function public.advance_match_winner(
  p_match_id uuid,
  p_winner_id uuid,
  p_score_a int default 0,
  p_score_b int default 0
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_is_team_a boolean;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can score matches';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;

  if p_winner_id is not null and p_winner_id not in (v_match.team_a_id, v_match.team_b_id) then
    raise exception 'Winner must be one of the participating teams';
  end if;

  -- Update current match score and winner
  update public.matches
  set winner_id = p_winner_id,
      score_a = coalesce(p_score_a, 0),
      score_b = coalesce(p_score_b, 0)
  where id = p_match_id;

  -- Forward to next match if present
  if v_match.next_match_id is not null then
    v_is_team_a := (v_match.position_in_round % 2) = 1;

    if v_is_team_a then
      update public.matches set team_a_id = p_winner_id where id = v_match.next_match_id;
    else
      update public.matches set team_b_id = p_winner_id where id = v_match.next_match_id;
    end if;
  else
    -- Final match complete
    if p_winner_id is not null then
      update public.tournaments set status = 'completed' where id = v_match.tournament_id;
    end if;
  end if;
end;
$$;


-- 4. HELPER: Close registration early (Admin only)
create or replace function public.close_registration_manually(p_tournament_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  update public.tournaments
  set status = 'registration_closed'
  where id = p_tournament_id and status in ('upcoming', 'registration_open');
end;
$$;


-- 5. HELPER: Reset bracket to registration_closed or in_progress (Admin only)
create or replace function public.reset_bracket(p_tournament_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  delete from public.matches where tournament_id = p_tournament_id;
  update public.teams set bracket_position = null where tournament_id = p_tournament_id;
  update public.tournaments set status = 'registration_closed' where id = p_tournament_id;
end;
$$;

-- ==============================================================================
-- 6. TOURNAMENT PRIZES & LFG (LOOKING FOR GROUP / TEAMMATES)
-- ==============================================================================

alter table public.tournaments
  add column if not exists prize_first text,
  add column if not exists prize_second text,
  add column if not exists prize_third text;

create table if not exists public.lfg_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  discord_tag text not null,
  steam_id text,
  faceit_elo int,
  faceit_level int,
  role text not null default 'Любая',
  description text,
  created_at timestamptz not null default now(),
  unique(tournament_id, user_id)
);

alter table public.lfg_requests enable row level security;

drop policy if exists "lfg_select_all" on public.lfg_requests;
create policy "lfg_select_all" on public.lfg_requests
  for select using (true);

drop policy if exists "lfg_insert_own" on public.lfg_requests;
create policy "lfg_insert_own" on public.lfg_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "lfg_delete_own_or_admin" on public.lfg_requests;
create policy "lfg_delete_own_or_admin" on public.lfg_requests
  for delete using (auth.uid() = user_id or public.is_admin());

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

create index if not exists idx_team_join_requests_team on public.team_join_requests(team_id);
create index if not exists idx_team_join_requests_user on public.team_join_requests(user_id);
create index if not exists idx_team_join_requests_tourn on public.team_join_requests(tournament_id);

alter table public.team_join_requests enable row level security;

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


