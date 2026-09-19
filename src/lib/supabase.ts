import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Tournament,
  Team,
  Match,
  Profile,
  LfgRequest,
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

  constructor() {
    this.load();
  }

  load() {
    const savedT = localStorage.getItem('demo_tournaments');
    const savedTeams = localStorage.getItem('demo_teams');
    const savedM = localStorage.getItem('demo_matches');
    const savedLfg = localStorage.getItem('demo_lfg');

    this.tournaments = savedT ? JSON.parse(savedT) : [...INITIAL_DEMO_TOURNAMENTS];
    this.teams = savedTeams ? JSON.parse(savedTeams) : [...INITIAL_DEMO_TEAMS];
    this.matches = savedM ? JSON.parse(savedM) : [...INITIAL_DEMO_MATCHES];
    this.lfgRequests = savedLfg ? JSON.parse(savedLfg) : [];
  }

  save() {
    localStorage.setItem('demo_tournaments', JSON.stringify(this.tournaments));
    localStorage.setItem('demo_teams', JSON.stringify(this.teams));
    localStorage.setItem('demo_matches', JSON.stringify(this.matches));
    localStorage.setItem('demo_lfg', JSON.stringify(this.lfgRequests));
  }

  reset() {
    this.tournaments = [...INITIAL_DEMO_TOURNAMENTS];
    this.teams = [...INITIAL_DEMO_TEAMS];
    this.matches = [...INITIAL_DEMO_MATCHES];
    this.lfgRequests = [];
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
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        ...params,
        created_by: userProfile.id,
        status: initialStatus,
      })
      .select('*, creator:profiles(*)')
      .single();

    if (error) throw error;
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
    const { error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id);

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
