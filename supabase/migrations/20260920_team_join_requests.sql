-- ==============================================================================
-- BAZA CS2 TOURNAMENT PLATFORM: COMPREHENSIVE UPDATE MIGRATION
-- Includes:
-- 1. team_join_requests table (invites & applications)
-- 2. tournament flexible rules (allow_lvl10, max_lvl10_per_team, min/max level, max_faceit_elo)
-- 3. tournament_blacklist table (global & tournament-specific bans)
-- 4. respond_to_team_join_request atomic RPC (bypasses captain-only RLS safely)
-- 5. admin_delete_team & admin_delete_lfg RPCs
-- ==============================================================================

-- 1. TOURNAMENTS TABLE EXTENSIONS
alter table public.tournaments
  add column if not exists prize_first text,
  add column if not exists prize_second text,
  add column if not exists prize_third text,
  add column if not exists allow_lvl10 boolean not null default true,
  add column if not exists max_lvl10_per_team int default null,
  add column if not exists min_faceit_level int not null default 1,
  add column if not exists max_faceit_level int not null default 10,
  add column if not exists min_faceit_elo int default null,
  add column if not exists max_faceit_elo int default null;

-- 2. LFG_REQUESTS TABLE EXTENSIONS
alter table public.lfg_requests
  add column if not exists steam_id text,
  add column if not exists faceit_elo int,
  add column if not exists faceit_level int;

-- Update LFG policies to allow tournament creator or admin to delete any survey
drop policy if exists "lfg_delete_own_or_admin" on public.lfg_requests;
create policy "lfg_delete_own_or_admin" on public.lfg_requests
  for delete using (
    auth.uid() = user_id 
    or public.is_admin()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );

-- 3. TEAM_JOIN_REQUESTS TABLE
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

-- 4. TOURNAMENT_BLACKLIST TABLE
create table if not exists public.tournament_blacklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  steam_id text,
  discord_username text,
  reason text,
  tournament_id uuid references public.tournaments(id) on delete cascade, -- NULL = global ban, UUID = tournament ban
  banned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_blacklist_user on public.tournament_blacklist(user_id);
create index if not exists idx_blacklist_steam on public.tournament_blacklist(steam_id);
create index if not exists idx_blacklist_tourn on public.tournament_blacklist(tournament_id);

alter table public.tournament_blacklist enable row level security;

drop policy if exists "blacklist_select_public" on public.tournament_blacklist;
create policy "blacklist_select_public" on public.tournament_blacklist
  for select using (true);

drop policy if exists "blacklist_modify_admin" on public.tournament_blacklist;
create policy "blacklist_modify_admin" on public.tournament_blacklist
  for all using (
    public.is_admin() or exists (
      select 1 from public.tournaments t
      where t.id = tournament_blacklist.tournament_id and t.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.tournaments t
      where t.id = tournament_blacklist.tournament_id and t.created_by = auth.uid()
    )
  );

-- 5. ATOMIC RPC: respond_to_team_join_request
-- Solves RLS issue where invited players couldn't insert into team_members!
create or replace function public.respond_to_team_join_request(
  p_request_id uuid,
  p_action text, -- 'accept' or 'reject'
  p_format text  -- '1x1', '2x2', '5x5'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
  v_team record;
  v_tourn record;
  v_max_members int;
  v_current_count int;
  v_lvl10_count int;
  v_is_banned boolean;
begin
  if auth.uid() is null then
    raise exception 'Пользователь не авторизован';
  end if;

  select * into v_req from public.team_join_requests where id = p_request_id;
  if not found then
    raise exception 'Запрос не найден';
  end if;

  select * into v_team from public.teams where id = v_req.team_id;
  if not found then
    raise exception 'Команда не найдена';
  end if;

  select * into v_tourn from public.tournaments where id = v_req.tournament_id;
  if not found then
    raise exception 'Турнир не найден';
  end if;

  -- Security authorization check
  if v_req.type = 'invite' then
    -- Only the invited player can accept/reject their invite
    if auth.uid() <> v_req.user_id and not public.is_admin() then
      raise exception 'Вы можете отвечать только на свои приглашения';
    end if;
  elsif v_req.type = 'application' then
    -- Only team captain or admin/organizer can accept/reject applicant
    if auth.uid() <> v_team.captain_id and auth.uid() <> v_tourn.created_by and not public.is_admin() then
      raise exception 'Только капитан команды или организатор может рассматривать заявки';
    end if;
  end if;

  -- If rejecting:
  if p_action = 'reject' then
    update public.team_join_requests
    set status = 'rejected', updated_at = now()
    where id = p_request_id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  -- Action is 'accept': Check blacklist
  select exists (
    select 1 from public.tournament_blacklist b
    where (b.user_id = v_req.user_id or (b.steam_id is not null and b.steam_id = v_req.steam_id))
      and (b.tournament_id is null or b.tournament_id = v_req.tournament_id)
  ) into v_is_banned;

  if v_is_banned then
    raise exception 'Игрок находится в черном списке турнира и не может быть зачислен в состав';
  end if;

  -- Check team capacity
  v_max_members := case v_tourn.format
    when '1x1' then 1
    when '2x2' then 2
    when '5x5' then 5
    else 5
  end;

  select count(*) into v_current_count from public.team_members where team_id = v_team.id;
  if v_current_count >= v_max_members then
    update public.team_join_requests
    set status = 'cancelled', updated_at = now()
    where id = p_request_id;
    raise exception 'Команда уже полностью укомплектована (максимум % участников)', v_max_members;
  end if;

  -- Check Faceit Tournament Rules
  if v_tourn.allow_lvl10 = false and v_req.faceit_level = 10 then
    raise exception 'На этом турнире запрещено участие игроков 10 уровня Faceit';
  end if;

  if v_tourn.max_faceit_elo is not null and v_req.faceit_elo > v_tourn.max_faceit_elo then
    raise exception 'Faceit ELO игрока (% ELO) превышает установленный лимит турнира (% ELO)', v_req.faceit_elo, v_tourn.max_faceit_elo;
  end if;

  if v_tourn.max_faceit_level is not null and v_req.faceit_level > v_tourn.max_faceit_level then
    raise exception 'Faceit уровень игрока (% lvl) превышает максимальный разрешенный уровень турнира (% lvl)', v_req.faceit_level, v_tourn.max_faceit_level;
  end if;

  if v_tourn.min_faceit_level is not null and v_req.faceit_level < v_tourn.min_faceit_level then
    raise exception 'Faceit уровень игрока (% lvl) ниже минимального разрешенного уровня турнира (% lvl)', v_req.faceit_level, v_tourn.min_faceit_level;
  end if;

  -- Check max 10 lvl players per team rule
  if v_tourn.max_lvl10_per_team is not null and v_req.faceit_level = 10 then
    select count(*) into v_lvl10_count from public.team_members
    where team_id = v_team.id and faceit_level = 10;

    if v_lvl10_count >= v_tourn.max_lvl10_per_team then
      raise exception 'В команде уже достигнут лимит игроков 10 уровня Faceit (максимум: %)', v_tourn.max_lvl10_per_team;
    end if;
  end if;

  -- Insert into team members
  insert into public.team_members (
    team_id,
    steam_id,
    faceit_nickname,
    faceit_level,
    faceit_elo,
    is_captain
  ) values (
    v_team.id,
    v_req.steam_id,
    v_req.nickname,
    v_req.faceit_level,
    v_req.faceit_elo,
    false
  );

  -- Mark request accepted
  update public.team_join_requests
  set status = 'accepted', updated_at = now()
  where id = p_request_id;

  -- Clean up applicant's LFG survey
  delete from public.lfg_requests
  where tournament_id = v_tourn.id
    and (user_id = v_req.user_id or (steam_id is not null and steam_id = v_req.steam_id));

  -- If team is now full, cancel remaining pending requests for this team
  if v_current_count + 1 >= v_max_members then
    update public.team_join_requests
    set status = 'cancelled', updated_at = now()
    where team_id = v_team.id and status = 'pending';
  end if;

  return jsonb_build_object('success', true, 'status', 'accepted');
end;
$$;

-- 6. RPC: admin_delete_team (delete any team by admin or tournament creator)
create or replace function public.admin_delete_team(p_team_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_team record;
  v_tourn record;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then raise exception 'Команда не найдена'; end if;

  select * into v_tourn from public.tournaments where id = v_team.tournament_id;

  if not public.is_admin() and (auth.uid() is distinct from v_tourn.created_by) then
    raise exception 'Недостаточно прав для удаления команды';
  end if;

  -- Delete team (cascades to team_members and matches team_a/b null)
  delete from public.teams where id = p_team_id;

  -- Cancel all pending join requests for this team
  update public.team_join_requests
  set status = 'cancelled', updated_at = now()
  where team_id = p_team_id and status = 'pending';
end;
$$;

-- 7. RPC: admin_delete_lfg (delete any LFG survey by admin or tournament creator)
create or replace function public.admin_delete_lfg(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_lfg record;
  v_tourn record;
begin
  select * into v_lfg from public.lfg_requests where id = p_request_id;
  if not found then return; end if;

  select * into v_tourn from public.tournaments where id = v_lfg.tournament_id;

  if not public.is_admin() and (auth.uid() is distinct from v_tourn.created_by) and (auth.uid() is distinct from v_lfg.user_id) then
    raise exception 'Недостаточно прав для удаления анкеты';
  end if;

  delete from public.lfg_requests where id = p_request_id;
end;
$$;
