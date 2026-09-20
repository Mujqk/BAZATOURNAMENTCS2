import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Tournament,
  TournamentFormat,
  Team,
  Match,
  Profile,
  LfgRequest,
  TeamJoinRequest,
  TournamentBlacklistEntry,
} from '../types/database.types';
import {
  INITIAL_DEMO_TOURNAMENTS,
  INITIAL_DEMO_TEAMS,
  INITIAL_DEMO_MATCHES,
} from './demoData';

// Storage keys for user credentials
const URL_KEY = 'cs2_supabase_url';
const ANON_KEY = 'cs2_supabase_anon_key';

export function getSupabaseCredentials() {
  let storedUrl = localStorage.getItem(URL_KEY);
  let storedKey = localStorage.getItem(ANON_KEY);

  // Automatically purge secret keys if accidentally saved in localStorage
  if (storedKey && (storedKey.startsWith('sb_secret_') || storedKey.includes('secret'))) {
    localStorage.removeItem(ANON_KEY);
    storedKey = null;
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = (storedUrl || envUrl || '').trim();
  const anonKey = (storedKey || envKey || '').trim();

  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  const cleanKey = anonKey.trim();
  if (cleanKey.startsWith('sb_secret_')) {
    alert('Внимание: Вы ввели секретный (secret) ключ. Для работы сайта в браузере нужен публичный (anon / public) ключ из Project Settings -> API.');
    return;
  }

  if (url) localStorage.setItem(URL_KEY, url.trim());
  else localStorage.removeItem(URL_KEY);

  if (cleanKey) localStorage.setItem(ANON_KEY, cleanKey);
  else localStorage.removeItem(ANON_KEY);

  window.location.reload();
}

const { url: initialUrl, anonKey: initialAnonKey } = getSupabaseCredentials();

export const isSupabaseConfigured = Boolean(
  initialUrl && initialAnonKey && initialUrl.startsWith('https://') && !initialAnonKey.startsWith('sb_secret_')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(initialUrl, initialAnonKey)
  : null;

// ==============================================================================
// IN-MEMORY / LOCAL STORAGE STORE (For seamless instant testing & preview)
// ==============================================================================

class DemoStore {
  tournaments: Tournament[] = [];
  teams: Team[] = [];
  matches: Match[] = [];
  lfgRequests: LfgRequest[] = [];
  teamJoinRequests: TeamJoinRequest[] = [];
  blacklist: TournamentBlacklistEntry[] = [];

  constructor() {
    this.load();
  }

  load() {
    const savedT = localStorage.getItem('demo_tournaments');
    const savedTeams = localStorage.getItem('demo_teams');
    const savedM = localStorage.getItem('demo_matches');
    const savedLfg = localStorage.getItem('demo_lfg');
    const savedReqs = localStorage.getItem('demo_join_requests');
    const savedB = localStorage.getItem('demo_blacklist');

    this.tournaments = savedT ? JSON.parse(savedT) : [...INITIAL_DEMO_TOURNAMENTS];
    this.teams = savedTeams ? JSON.parse(savedTeams) : [...INITIAL_DEMO_TEAMS];
    this.matches = savedM ? JSON.parse(savedM) : [...INITIAL_DEMO_MATCHES];
    this.lfgRequests = savedLfg ? JSON.parse(savedLfg) : [];
    this.teamJoinRequests = savedReqs ? JSON.parse(savedReqs) : [];
    this.blacklist = savedB ? JSON.parse(savedB) : [];
  }

  save() {
    localStorage.setItem('demo_tournaments', JSON.stringify(this.tournaments));
    localStorage.setItem('demo_teams', JSON.stringify(this.teams));
    localStorage.setItem('demo_matches', JSON.stringify(this.matches));
    localStorage.setItem('demo_lfg', JSON.stringify(this.lfgRequests));
    localStorage.setItem('demo_join_requests', JSON.stringify(this.teamJoinRequests));
    localStorage.setItem('demo_blacklist', JSON.stringify(this.blacklist));
  }

  reset() {
    this.tournaments = [...INITIAL_DEMO_TOURNAMENTS];
    this.teams = [...INITIAL_DEMO_TEAMS];
    this.matches = [...INITIAL_DEMO_MATCHES];
    this.lfgRequests = [];
    this.teamJoinRequests = [];
    this.blacklist = [];
    this.save();
  }
}

export const demoStore = new DemoStore();

// ==============================================================================
// UNIFIED DATA ACCESS API (Routes to Supabase or Demo Store)
// ==============================================================================

export async function fetchTournaments(): Promise<Tournament[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, creator:profiles(*), teams(id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      teams_count: t.teams ? t.teams.length : 0,
    }));
  }

  return demoStore.tournaments.map((t) => ({
    ...t,
    teams_count: demoStore.teams.filter((team) => team.tournament_id === t.id).length,
  }));
}

export async function fetchTournamentById(id: string): Promise<{
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
} | null> {
  if (supabase) {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('*, creator:profiles(*)')
      .eq('id', id)
      .single();

    if (tErr) throw tErr;

    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('*, captain:profiles(*), members:team_members(*)')
      .eq('tournament_id', id)
      .order('created_at', { ascending: true });

    if (teamsErr) throw teamsErr;

    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*), winner:teams!matches_winner_id_fkey(*)')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('position_in_round', { ascending: true });

    if (mErr) throw mErr;

    return { tournament, teams: teams || [], matches: matches || [] };
  }

  const tournament = demoStore.tournaments.find((t) => t.id === id);
  if (!tournament) return null;

  const teams = demoStore.teams.filter((team) => team.tournament_id === id);
  const matches = demoStore.matches
    .filter((m) => m.tournament_id === id)
    .map((m) => ({
      ...m,
      team_a: teams.find((t) => t.id === m.team_a_id) || null,
      team_b: teams.find((t) => t.id === m.team_b_id) || null,
      winner: teams.find((t) => t.id === m.winner_id) || null,
    }));

  return { tournament, teams, matches };
}

export async function createTournament(
  params: Omit<Tournament, 'id' | 'created_at' | 'status' | 'teams_count'>,
  userProfile: Profile
): Promise<Tournament> {
  const initialStatus = new Date(params.registration_start) <= new Date() ? 'registration_open' : 'upcoming';

  if (supabase) {
    const payload: any = {
      ...params,
      created_by: userProfile.id,
      status: initialStatus,
    };

    let { data, error } = await supabase
      .from('tournaments')
      .insert(payload)
      .select('*, creator:profiles(*)')
      .single();

    // Graceful fallback: if database table is missing prize or rules columns, insert without them
    if (error && (error.message?.includes('prize_') || error.message?.includes('lvl10') || error.message?.includes('faceit_') || error.message?.includes("column of 'tournaments'") || error.code === 'PGRST204')) {
      const {
        prize_first, prize_second, prize_third,
        allow_lvl10, max_lvl10_per_team, min_faceit_level, max_faceit_level, min_faceit_elo, max_faceit_elo,
        ...legacyPayload
      } = payload;
      const retry = await supabase
        .from('tournaments')
        .insert(legacyPayload)
        .select('*, creator:profiles(*)')
        .single();

      if (retry.error) throw retry.error;
      data = {
        ...retry.data,
        prize_first,
        prize_second,
        prize_third,
        allow_lvl10,
        max_lvl10_per_team,
        min_faceit_level,
        max_faceit_level,
        min_faceit_elo,
        max_faceit_elo,
      };
    } else if (error) {
      throw error;
    }

    return data;
  }

  const newT: Tournament = {
    id: `t-${Date.now()}`,
    ...params,
    status: initialStatus,
    created_by: userProfile.id,
    created_at: new Date().toISOString(),
    creator: userProfile,
    teams_count: 0,
  };

  demoStore.tournaments.unshift(newT);
  demoStore.save();
  return newT;
}

export async function updateTournament(
  id: string,
  updates: Partial<Omit<Tournament, 'id' | 'created_at' | 'created_by' | 'teams_count'>>
): Promise<void> {
  if (supabase) {
    let { error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id);

    if (error && (error.message?.includes('prize_') || error.message?.includes('lvl10') || error.message?.includes('faceit_') || error.message?.includes("column of 'tournaments'") || error.code === 'PGRST204')) {
      const {
        prize_first, prize_second, prize_third,
        allow_lvl10, max_lvl10_per_team, min_faceit_level, max_faceit_level, min_faceit_elo, max_faceit_elo,
        ...legacyUpdates
      } = updates as any;
      const retry = await supabase
        .from('tournaments')
        .update(legacyUpdates)
        .eq('id', id);

      if (retry.error) throw retry.error;
      return;
    }

    if (error) throw error;
    return;
  }

  const tIndex = demoStore.tournaments.findIndex((t) => t.id === id);
  if (tIndex >= 0) {
    demoStore.tournaments[tIndex] = { ...demoStore.tournaments[tIndex], ...updates };
    demoStore.save();
  }
}

export async function deleteTournament(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return;
  }

  demoStore.tournaments = demoStore.tournaments.filter((t) => t.id !== id);
  demoStore.teams = demoStore.teams.filter((team) => team.tournament_id !== id);
  demoStore.matches = demoStore.matches.filter((m) => m.tournament_id !== id);
  demoStore.save();
}

export async function registerTeamAtomic(
  tournamentId: string,
  teamName: string,
  members: { steam_id: string; faceit_nickname: string | null; faceit_level: number | null; faceit_elo: number | null; is_captain: boolean }[],
  userProfile: Profile
): Promise<string> {
  if (supabase) {
    const { data, error } = await supabase.rpc('register_team_atomic', {
      p_tournament_id: tournamentId,
      p_team_name: teamName,
      p_members: members,
    });

    if (!error && data) {
      return data;
    }

    // If RPC returned error about member count (because in 2x2/5x5 teammates are optional),
    // fallback to direct table insert permitted by RLS:
    if (error && (error.message?.includes('Invalid number of members') || error.message?.includes('expected'))) {
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          name: teamName || (members[0]?.faceit_nickname ?? userProfile.discord_username),
          captain_id: userProfile.id,
        })
        .select()
        .single();

      if (teamErr) throw teamErr;

      if (members.length > 0) {
        const membersPayload = members.map((m) => ({
          team_id: newTeam.id,
          steam_id: m.steam_id,
          faceit_nickname: m.faceit_nickname,
          faceit_level: m.faceit_level,
          faceit_elo: m.faceit_elo,
          is_captain: Boolean(m.is_captain),
        }));

        const { error: membersErr } = await supabase
          .from('team_members')
          .insert(membersPayload);

        if (membersErr) {
          console.warn('Member insertion warning:', membersErr);
        }
      }

      return newTeam.id;
    }

    if (error) throw error;
    return data;
  }

  const tournament = demoStore.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Турнир не найден');

  const currentTeams = demoStore.teams.filter((t) => t.tournament_id === tournamentId);
  if (currentTeams.length >= tournament.bracket_size) {
    throw new Error('Все слоты турнира уже заняты');
  }

  const teamId = `team-${Date.now()}`;
  const newTeam: Team = {
    id: teamId,
    tournament_id: tournamentId,
    name: teamName || (members[0]?.faceit_nickname ?? userProfile.discord_username),
    captain_id: userProfile.id,
    bracket_position: null,
    created_at: new Date().toISOString(),
    captain: userProfile,
    members: members.map((m, idx) => ({
      id: `m-${Date.now()}-${idx}`,
      team_id: teamId,
      steam_id: m.steam_id,
      faceit_nickname: m.faceit_nickname,
      faceit_level: m.faceit_level,
      faceit_elo: m.faceit_elo,
      is_captain: m.is_captain,
    })),
  };

  demoStore.teams.push(newTeam);

  if (currentTeams.length + 1 >= tournament.bracket_size) {
    tournament.status = 'registration_closed';
  } else if (tournament.status === 'upcoming') {
    tournament.status = 'registration_open';
  }

  demoStore.save();
  return teamId;
}

export async function cancelTeamRegistration(teamId: string) {
  if (supabase) {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw error;
    return;
  }

  demoStore.teams = demoStore.teams.filter((t) => t.id !== teamId);
  demoStore.save();
}

export async function adminDeleteTeam(teamId: string): Promise<void> {
  if (supabase) {
    const { error: rpcErr } = await supabase.rpc('admin_delete_team', { p_team_id: teamId });
    if (!rpcErr) return;

    // Fallback to direct table delete
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error && !rpcErr) throw error;
    if (error && rpcErr) throw new Error(rpcErr.message || error.message);
    return;
  }

  demoStore.teams = demoStore.teams.filter((t) => t.id !== teamId);
  demoStore.save();
}

export async function addTeamMember(
  teamId: string,
  member: {
    steam_id: string;
    faceit_nickname: string | null;
    faceit_level: number | null;
    faceit_elo: number | null;
    is_captain?: boolean;
  },
  options?: {
    maxMembers?: number;
    tournamentId?: string;
    userId?: string;
  }
) {
  if (supabase) {
    if (options?.maxMembers) {
      const { data: currentMembers } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId);
      if (currentMembers && currentMembers.length >= options.maxMembers) {
        throw new Error(`Команда уже заполнена (максимум ${options.maxMembers} участников). Свободных мест больше нет.`);
      }
    }

    const { error } = await supabase.from('team_members').insert({
      team_id: teamId,
      steam_id: member.steam_id,
      faceit_nickname: member.faceit_nickname,
      faceit_level: member.faceit_level,
      faceit_elo: member.faceit_elo,
      is_captain: Boolean(member.is_captain),
    });
    if (error) throw error;

    if (options?.tournamentId) {
      if (options.userId) await removeLfgRequestForUser(options.tournamentId, options.userId);
      if (member.steam_id) await removeLfgRequestForUser(options.tournamentId, member.steam_id);
    }
    return;
  }

  const team = demoStore.teams.find((t) => t.id === teamId);
  if (team) {
    if (!team.members) team.members = [];
    if (options?.maxMembers && team.members.length >= options.maxMembers) {
      throw new Error(`Команда уже заполнена (максимум ${options.maxMembers} участников). Свободных мест больше нет.`);
    }

    team.members.push({
      id: `m-${Date.now()}`,
      team_id: teamId,
      steam_id: member.steam_id,
      faceit_nickname: member.faceit_nickname,
      faceit_level: member.faceit_level,
      faceit_elo: member.faceit_elo,
      is_captain: Boolean(member.is_captain),
    });

    if (options?.tournamentId) {
      if (options.userId) {
        demoStore.lfgRequests = demoStore.lfgRequests.filter(
          (lfg) => !(lfg.tournament_id === options.tournamentId && lfg.user_id === options.userId)
        );
      }
      if (member.steam_id) {
        demoStore.lfgRequests = demoStore.lfgRequests.filter(
          (lfg) => !(lfg.tournament_id === options.tournamentId && lfg.steam_id === member.steam_id)
        );
      }
    }
    demoStore.save();
  }

}

export async function removeTeamMember(memberId: string) {
  if (supabase) {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) throw error;
    return;
  }

  for (const team of demoStore.teams) {
    if (team.members) {
      team.members = team.members.filter((m) => m.id !== memberId);
    }
  }
  demoStore.save();
}

export async function generateBracket(tournamentId: string, seedType: 'random' | 'faceit_elo' = 'random') {
  if (supabase) {
    const { error } = await supabase.rpc('generate_bracket', {
      p_tournament_id: tournamentId,
      p_seed_type: seedType,
    });
    if (error) throw error;
    return;
  }

  const tournament = demoStore.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const teams = demoStore.teams.filter((t) => t.tournament_id === tournamentId);
  if (teams.length < 2) {
    throw new Error('Для генерации сетки необходимо минимум 2 зарегистрированные команды');
  }

  demoStore.matches = demoStore.matches.filter((m) => m.tournament_id !== tournamentId);

  let sortedTeams = [...teams];
  if (seedType === 'random') {
    sortedTeams.sort(() => Math.random() - 0.5);
  } else {
    sortedTeams.sort((a, b) => {
      const avgA = (a.members || []).reduce((acc, m) => acc + (m.faceit_elo || 0), 0) / (a.members?.length || 1);
      const avgB = (b.members || []).reduce((acc, m) => acc + (m.faceit_elo || 0), 0) / (b.members?.length || 1);
      return avgB - avgA;
    });
  }

  sortedTeams.forEach((t, i) => {
    t.bracket_position = i + 1;
  });

  const bracketSize = tournament.bracket_size;
  const totalRounds = Math.ceil(Math.log2(bracketSize));

  const roundMap: Record<number, Match[]> = {};

  for (let r = totalRounds; r >= 1; r--) {
    const matchCount = Math.pow(2, totalRounds - r);
    roundMap[r] = [];

    for (let p = 1; p <= matchCount; p++) {
      const matchId = `match-${tournamentId}-r${r}-p${p}`;
      const nextMatchId = r < totalRounds ? `match-${tournamentId}-r${r + 1}-p${Math.ceil(p / 2)}` : null;

      const newMatch: Match = {
        id: matchId,
        tournament_id: tournamentId,
        round: r,
        position_in_round: p,
        team_a_id: null,
        team_b_id: null,
        score_a: 0,
        score_b: 0,
        winner_id: null,
        next_match_id: nextMatchId,
      };

      roundMap[r].push(newMatch);
      demoStore.matches.push(newMatch);
    }
  }

  const round1Matches = roundMap[1] || [];
  for (let p = 1; p <= bracketSize / 2; p++) {
    const match = round1Matches.find((m) => m.position_in_round === p);
    if (!match) continue;

    const teamA = sortedTeams[p * 2 - 2] || null;
    const teamB = sortedTeams[p * 2 - 1] || null;

    match.team_a_id = teamA ? teamA.id : null;
    match.team_b_id = teamB ? teamB.id : null;

    if (teamA && !teamB && totalRounds > 1) {
      match.winner_id = teamA.id;
      match.score_a = 1;
      match.score_b = 0;

      const nextMatch = demoStore.matches.find((m) => m.id === match.next_match_id);
      if (nextMatch) {
        if (p % 2 === 1) nextMatch.team_a_id = teamA.id;
        else nextMatch.team_b_id = teamA.id;
      }
    }
  }

  tournament.status = 'in_progress';
  demoStore.save();
}

export async function advanceMatchWinner(
  matchId: string,
  winnerId: string,
  scoreA: number = 0,
  scoreB: number = 0
) {
  if (supabase) {
    const { error } = await supabase.rpc('advance_match_winner', {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_score_a: scoreA,
      p_score_b: scoreB,
    });
    if (error) throw error;
    return;
  }

  const match = demoStore.matches.find((m) => m.id === matchId);
  if (!match) throw new Error('Match not found');

  match.winner_id = winnerId;
  match.score_a = scoreA;
  match.score_b = scoreB;

  if (match.next_match_id) {
    const nextMatch = demoStore.matches.find((m) => m.id === match.next_match_id);
    if (nextMatch) {
      if (match.position_in_round % 2 === 1) {
        nextMatch.team_a_id = winnerId;
      } else {
        nextMatch.team_b_id = winnerId;
      }
    }
  } else {
    const tournament = demoStore.tournaments.find((t) => t.id === match.tournament_id);
    if (tournament) {
      tournament.status = 'completed';
    }
  }

  demoStore.save();
}

export async function openRegistrationManually(tournamentId: string) {
  if (supabase) {
    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'registration_open' })
      .eq('id', tournamentId);
    if (error) throw error;
    return;
  }

  const tournament = demoStore.tournaments.find((t) => t.id === tournamentId);
  if (tournament) {
    tournament.status = 'registration_open';
    demoStore.save();
  }
}

export async function closeRegistrationManually(tournamentId: string) {
  if (supabase) {
    const { error } = await supabase.rpc('close_registration_manually', {
      p_tournament_id: tournamentId,
    });
    if (error) throw error;
    return;
  }

  const tournament = demoStore.tournaments.find((t) => t.id === tournamentId);
  if (tournament) {
    tournament.status = 'registration_closed';
    demoStore.save();
  }
}

export async function resetTournamentBracket(tournamentId: string) {
  if (supabase) {
    const { error } = await supabase.rpc('reset_bracket', {
      p_tournament_id: tournamentId,
    });
    if (error) throw error;
    return;
  }

  demoStore.matches = demoStore.matches.filter((m) => m.tournament_id !== tournamentId);
  const tournament = demoStore.tournaments.find((t) => t.id === tournamentId);
  if (tournament) {
    tournament.status = 'registration_closed';
    demoStore.save();
  }
}

export async function fetchLfgRequests(tournamentId: string): Promise<LfgRequest[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('lfg_requests')
      .select('*, user:profiles(*)')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('LFG fetch notice:', error.message);
      return [];
    }
    return data || [];
  }

  return (demoStore.lfgRequests || []).filter((r: any) => r.tournament_id === tournamentId);
}

export async function createLfgRequest(
  request: Omit<LfgRequest, 'id' | 'created_at'>
): Promise<LfgRequest> {
  if (supabase) {
    const { data, error } = await supabase
      .from('lfg_requests')
      .insert(request)
      .select('*, user:profiles(*)')
      .single();

    if (error) throw error;
    return data;
  }

  const newReq: LfgRequest = {
    ...request,
    id: `lfg-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  demoStore.lfgRequests = [newReq, ...(demoStore.lfgRequests || [])];
  demoStore.save();
  return newReq;
}

export async function deleteLfgRequest(requestId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('lfg_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    return;
  }

  demoStore.lfgRequests = (demoStore.lfgRequests || []).filter((r: any) => r.id !== requestId);
  demoStore.save();
}

export async function adminDeleteLfgRequest(requestId: string): Promise<void> {
  if (supabase) {
    const { error: rpcErr } = await supabase.rpc('admin_delete_lfg', { p_request_id: requestId });
    if (!rpcErr) return;

    const { error } = await supabase.from('lfg_requests').delete().eq('id', requestId);
    if (error && !rpcErr) throw error;
    if (error && rpcErr) throw new Error(rpcErr.message || error.message);
    return;
  }

  demoStore.lfgRequests = (demoStore.lfgRequests || []).filter((r: any) => r.id !== requestId);
  demoStore.save();
}

export async function removeLfgRequestForUser(tournamentId: string, userIdOrSteamId: string): Promise<void> {
  if (!userIdOrSteamId) return;

  if (supabase) {
    try {
      await supabase
        .from('lfg_requests')
        .delete()
        .eq('tournament_id', tournamentId)
        .or(`user_id.eq.${userIdOrSteamId},steam_id.eq.${userIdOrSteamId}`);
    } catch (e) {
      console.warn('Notice removing LFG request:', e);
    }
    return;
  }

  demoStore.lfgRequests = (demoStore.lfgRequests || []).filter(
    (r) => !(r.tournament_id === tournamentId && (r.user_id === userIdOrSteamId || r.steam_id === userIdOrSteamId))
  );
  demoStore.save();
}

export async function updateLfgSteamId(
  requestId: string,
  steamId: string,
  faceitLevel?: number | null,
  faceitElo?: number | null
): Promise<void> {
  if (supabase) {
    try {
      const updates: any = { steam_id: steamId };
      if (faceitLevel !== undefined) updates.faceit_level = faceitLevel;
      if (faceitElo !== undefined) updates.faceit_elo = faceitElo;
      await supabase.from('lfg_requests').update(updates).eq('id', requestId);
    } catch (e) {
      console.warn('Notice updating LFG steam id:', e);
    }
    return;
  }

  const req = (demoStore.lfgRequests || []).find((r) => r.id === requestId);
  if (req) {
    req.steam_id = steamId;
    if (faceitLevel !== undefined) req.faceit_level = faceitLevel;
    if (faceitElo !== undefined) req.faceit_elo = faceitElo;
    demoStore.save();
  }
}

// ==============================================================================
// TEAM JOIN REQUESTS (Invites by Captain & Applications by Players)
// ==============================================================================

export async function fetchTeamJoinRequests(options: {
  tournamentId: string;
  teamId?: string;
  userId?: string;
}): Promise<TeamJoinRequest[]> {
  if (supabase) {
    try {
      let query = supabase
        .from('team_join_requests')
        .select('*, team:teams(*), user:profiles(*)')
        .eq('tournament_id', options.tournamentId);

      if (options.teamId) {
        query = query.eq('team_id', options.teamId);
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data;
      if (error) console.warn('team_join_requests fetch notice:', error.message);
    } catch (err) {
      console.warn('Fallback to local requests store:', err);
    }
  }

  return (demoStore.teamJoinRequests || []).filter((r) => {
    if (r.tournament_id !== options.tournamentId) return false;
    if (options.teamId && r.team_id !== options.teamId) return false;
    if (options.userId && r.user_id !== options.userId) return false;
    return true;
  });
}

export async function createTeamJoinRequest(
  request: Omit<TeamJoinRequest, 'id' | 'created_at' | 'status'>
): Promise<TeamJoinRequest> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('team_join_requests')
        .insert({
          ...request,
          status: 'pending',
        })
        .select('*, team:teams(*), user:profiles(*)')
        .single();

      if (!error && data) return data;
      if (error) console.warn('createTeamJoinRequest notice:', error.message);
    } catch (err) {
      console.warn('Fallback createTeamJoinRequest to local:', err);
    }
  }

  const newReq: TeamJoinRequest = {
    ...request,
    id: `req-${Date.now()}`,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  demoStore.teamJoinRequests = [newReq, ...(demoStore.teamJoinRequests || [])];
  demoStore.save();
  return newReq;
}

export async function cancelTeamJoinRequest(requestId: string): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from('team_join_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      return;
    } catch (e) {
      console.warn('Notice cancelling team join request:', e);
    }
  }

  const req = (demoStore.teamJoinRequests || []).find((r) => r.id === requestId);
  if (req) {
    req.status = 'cancelled';
    demoStore.save();
  }
}

export async function respondToTeamJoinRequest(
  requestId: string,
  action: 'accept' | 'reject',
  tournamentFormat: TournamentFormat
): Promise<void> {
  const maxMembers = tournamentFormat === '1x1' ? 1 : tournamentFormat === '2x2' ? 2 : 5;

  if (supabase) {
    // 1. Try calling atomic RPC in Supabase first
    try {
      const { error: rpcErr } = await supabase.rpc('respond_to_team_join_request', {
        p_request_id: requestId,
        p_action: action,
        p_format: tournamentFormat,
      });

      if (!rpcErr) {
        return;
      }

      // If error is an intentional business logic exception, rethrow it directly to the user!
      if (
        rpcErr.message &&
        !rpcErr.message.includes('Could not find the function') &&
        rpcErr.code !== 'PGRST202'
      ) {
        throw new Error(rpcErr.message);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Could not find the function') && err.code !== 'PGRST202') {
        throw err;
      }
    }

    // 2. Fallback direct table updates in Supabase
    try {
      const { data: req, error: reqErr } = await supabase
        .from('team_join_requests')
        .select('*, team:teams(*), tournament:tournaments(*)')
        .eq('id', requestId)
        .single();

      if (!reqErr && req) {
        if (action === 'reject') {
          await supabase
            .from('team_join_requests')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', requestId);
          return;
        }

        // Check blacklist
        const banCheck = await checkIsUserBanned({
          userId: req.user_id,
          steamId: req.steam_id,
          tournamentId: req.tournament_id,
        });
        if (banCheck.isBanned) {
          throw new Error(`Игрок не может быть принят: ${banCheck.reason || 'в черном списке'}`);
        }

        // Check tournament rules
        if (req.tournament) {
          const ruleCheck = validateFaceitTournamentRules(
            req.tournament,
            {
              faceit_level: req.faceit_level,
              faceit_elo: req.faceit_elo,
              nickname: req.nickname,
            },
            req.team?.members || []
          );
          if (!ruleCheck.valid) {
            throw new Error(ruleCheck.error);
          }
        }

        // Check member capacity
        const { data: currentMembers } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', req.team_id);

        const currentCount = currentMembers ? currentMembers.length : 0;
        if (currentCount >= maxMembers) {
          await supabase
            .from('team_join_requests')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', requestId);
          throw new Error(`Команда уже полностью укомплектована (максимум ${maxMembers} участников).`);
        }

        // Add to team members
        const { error: insErr } = await supabase.from('team_members').insert({
          team_id: req.team_id,
          steam_id: req.steam_id,
          faceit_nickname: req.nickname,
          faceit_level: req.faceit_level,
          faceit_elo: req.faceit_elo,
          is_captain: false,
        });
        if (insErr) throw insErr;

        // Mark request accepted
        await supabase
          .from('team_join_requests')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', requestId);

        // Remove applicant's LFG request
        await removeLfgRequestForUser(req.tournament_id, req.user_id);
        if (req.steam_id) {
          await removeLfgRequestForUser(req.tournament_id, req.steam_id);
        }

        if (currentCount + 1 >= maxMembers) {
          await supabase
            .from('team_join_requests')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('team_id', req.team_id)
            .eq('status', 'pending');
        }

        return;
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('укомплектована') || err.message.includes('Faceit') || err.message.includes('списке') || err.message.includes('лимит') || err.message.includes('запрещ'))) {
        throw err;
      }
      console.warn('respondToTeamJoinRequest direct notice:', err);
    }
  }

  // Demo store fallback
  const req = (demoStore.teamJoinRequests || []).find((r) => r.id === requestId);
  if (!req) throw new Error('Запрос не найден');

  if (action === 'reject') {
    req.status = 'rejected';
    demoStore.save();
    return;
  }

  // Blacklist check in demo store
  const banCheck = await checkIsUserBanned({
    userId: req.user_id,
    steamId: req.steam_id,
    tournamentId: req.tournament_id,
  });
  if (banCheck.isBanned) {
    throw new Error(`Игрок не может быть принят: ${banCheck.reason || 'в черном списке'}`);
  }

  const tournament = demoStore.tournaments.find((t) => t.id === req.tournament_id);
  const team = demoStore.teams.find((t) => t.id === req.team_id);
  const currentCount = team?.members ? team.members.length : 1;

  if (currentCount >= maxMembers) {
    req.status = 'cancelled';
    demoStore.save();
    throw new Error(`Команда уже полностью укомплектована (максимум ${maxMembers} участников).`);
  }

  if (tournament) {
    const ruleCheck = validateFaceitTournamentRules(
      tournament,
      {
        faceit_level: req.faceit_level,
        faceit_elo: req.faceit_elo,
        nickname: req.nickname,
      },
      team?.members || []
    );
    if (!ruleCheck.valid) {
      throw new Error(ruleCheck.error);
    }
  }

  if (team) {
    if (!team.members) team.members = [];
    team.members.push({
      id: `m-${Date.now()}`,
      team_id: req.team_id,
      steam_id: req.steam_id,
      faceit_nickname: req.nickname,
      faceit_level: req.faceit_level || null,
      faceit_elo: req.faceit_elo || null,
      is_captain: false,
    });
  }

  req.status = 'accepted';
  demoStore.lfgRequests = demoStore.lfgRequests.filter(
    (lfg) => !(lfg.tournament_id === req.tournament_id && (lfg.user_id === req.user_id || lfg.steam_id === req.steam_id))
  );

  if (team && team.members && team.members.length >= maxMembers) {
    demoStore.teamJoinRequests.forEach((r) => {
      if (r.team_id === team.id && r.status === 'pending') {
        r.status = 'cancelled';
      }
    });
  }

  demoStore.save();
}

// ==============================================================================
// BLACKLIST / BANS MANAGEMENT
// ==============================================================================

export async function fetchBlacklist(tournamentId?: string): Promise<TournamentBlacklistEntry[]> {
  if (supabase) {
    try {
      let query = supabase
        .from('tournament_blacklist')
        .select('*, user:profiles!tournament_blacklist_user_id_fkey(*), banner:profiles!tournament_blacklist_banned_by_fkey(*)');

      if (tournamentId) {
        query = query.or(`tournament_id.is.null,tournament_id.eq.${tournamentId}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data as TournamentBlacklistEntry[];
    } catch (e) {
      console.warn('Fallback fetchBlacklist to local:', e);
    }
  }

  return (demoStore.blacklist || []).filter((b) => {
    if (!tournamentId) return true;
    return !b.tournament_id || b.tournament_id === tournamentId;
  });
}

export async function addToBlacklist(entry: {
  userId?: string | null;
  steamId?: string | null;
  discordUsername?: string | null;
  reason?: string | null;
  tournamentId?: string | null;
  bannedBy: string;
}): Promise<TournamentBlacklistEntry> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tournament_blacklist')
        .insert({
          user_id: entry.userId || null,
          steam_id: entry.steamId?.trim() || null,
          discord_username: entry.discordUsername?.trim() || null,
          reason: entry.reason?.trim() || null,
          tournament_id: entry.tournamentId || null,
          banned_by: entry.bannedBy,
        })
        .select()
        .single();

      if (!error && data) return data as TournamentBlacklistEntry;
      if (error) console.warn('Supabase addToBlacklist notice:', error.message);
    } catch (e) {
      console.warn('Supabase addToBlacklist fallback to local:', e);
    }
  }

  const newBan: TournamentBlacklistEntry = {
    id: `ban-${Date.now()}`,
    user_id: entry.userId || null,
    steam_id: entry.steamId?.trim() || null,
    discord_username: entry.discordUsername?.trim() || null,
    reason: entry.reason?.trim() || null,
    tournament_id: entry.tournamentId || null,
    banned_by: entry.bannedBy,
    created_at: new Date().toISOString(),
  };

  demoStore.blacklist = [newBan, ...(demoStore.blacklist || [])];
  demoStore.save();
  return newBan;
}

export async function removeFromBlacklist(banId: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('tournament_blacklist').delete().eq('id', banId);
      if (!error) return;
    } catch (e) {
      console.warn('Supabase removeFromBlacklist fallback to local:', e);
    }
  }

  demoStore.blacklist = (demoStore.blacklist || []).filter((b) => b.id !== banId);
  demoStore.save();
}

export async function checkIsUserBanned(options: {
  userId?: string | null;
  steamId?: string | null;
  tournamentId?: string | null;
}): Promise<{ isBanned: boolean; reason?: string | null }> {
  const bans = await fetchBlacklist(options.tournamentId || undefined);
  const ban = bans.find((b) => {
    const matchUser = options.userId && b.user_id && b.user_id === options.userId;
    const matchSteam = options.steamId && b.steam_id && b.steam_id === options.steamId;
    return matchUser || matchSteam;
  });

  if (ban) {
    return {
      isBanned: true,
      reason: ban.reason || (ban.tournament_id ? 'Запрет на участие в этом турнире' : 'Внесен в черный список турниров'),
    };
  }
  return { isBanned: false };
}

// ==============================================================================
// TOURNAMENT FACEIT RULES VALIDATOR
// ==============================================================================

export function validateFaceitTournamentRules(
  tournament: Tournament,
  player: {
    faceit_level?: number | null;
    faceit_elo?: number | null;
    nickname?: string;
  },
  existingTeamMembers: { faceit_level?: number | null }[] = []
): { valid: boolean; error?: string } {
  const lvl = player.faceit_level;
  const elo = player.faceit_elo;
  const name = player.nickname || 'Игрок';

  // 1. Allow lvl 10 check
  if (tournament.allow_lvl10 === false && lvl === 10) {
    return {
      valid: false,
      error: `На турнире запрещено участие игроков 10 уровня Faceit (${name} имеет 10 lvl).`,
    };
  }

  // 2. Max Faceit ELO check (e.g. 2500, 3000 ELO limit)
  if (
    tournament.max_faceit_elo !== null &&
    tournament.max_faceit_elo !== undefined &&
    elo !== null &&
    elo !== undefined &&
    elo > tournament.max_faceit_elo
  ) {
    return {
      valid: false,
      error: `Faceit ELO игрока ${name} (${elo} ELO) превышает установленный регламентом турнира максимум (${tournament.max_faceit_elo} ELO).`,
    };
  }

  // 3. Min Faceit ELO check
  if (
    tournament.min_faceit_elo !== null &&
    tournament.min_faceit_elo !== undefined &&
    elo !== null &&
    elo !== undefined &&
    elo < tournament.min_faceit_elo
  ) {
    return {
      valid: false,
      error: `Faceit ELO игрока ${name} (${elo} ELO) ниже минимального порога турнира (${tournament.min_faceit_elo} ELO).`,
    };
  }

  // 4. Max Faceit Level check
  if (
    tournament.max_faceit_level !== null &&
    tournament.max_faceit_level !== undefined &&
    lvl !== null &&
    lvl !== undefined &&
    lvl > tournament.max_faceit_level
  ) {
    return {
      valid: false,
      error: `Уровень Faceit игрока ${name} (${lvl} lvl) выше максимально допустимого регламентом (${tournament.max_faceit_level} lvl).`,
    };
  }

  // 5. Min Faceit Level check
  if (
    tournament.min_faceit_level !== null &&
    tournament.min_faceit_level !== undefined &&
    lvl !== null &&
    lvl !== undefined &&
    lvl < tournament.min_faceit_level
  ) {
    return {
      valid: false,
      error: `Уровень Faceit игрока ${name} (${lvl} lvl) ниже минимально допустимого регламентом (${tournament.min_faceit_level} lvl).`,
    };
  }

  // 6. Max lvl 10 players in one team
  if (
    tournament.max_lvl10_per_team !== null &&
    tournament.max_lvl10_per_team !== undefined &&
    lvl === 10
  ) {
    const currentLvl10Count = existingTeamMembers.filter((m) => m.faceit_level === 10).length;
    if (currentLvl10Count >= tournament.max_lvl10_per_team) {
      return {
        valid: false,
        error: `В команде уже достигнут максимум игроков 10 уровня Faceit (разрешено не более ${tournament.max_lvl10_per_team} в составе).`,
      };
    }
  }

  return { valid: true };
}

