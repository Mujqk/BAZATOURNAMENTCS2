export type TournamentFormat = '1x1' | '2x2' | '5x5';

export type TournamentStatus =
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Profile {
  id: string;
  discord_id: string;
  discord_username: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  format: TournamentFormat;
  bracket_size: 4 | 8 | 16 | 32;
  registration_start: string;
  tournament_start: string;
  status: TournamentStatus;
  created_by: string;
  created_at: string;
  creator?: Profile;
  teams_count?: number;
  prize_first?: string | null;
  prize_second?: string | null;
  prize_third?: string | null;
  allow_lvl10?: boolean;
  max_lvl10_per_team?: number | null;
  min_faceit_level?: number;
  max_faceit_level?: number;
  min_faceit_elo?: number | null;
  max_faceit_elo?: number | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  steam_id: string;
  faceit_nickname: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
  is_captain: boolean;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string | null;
  captain_id: string;
  bracket_position: number | null;
  created_at: string;
  captain?: Profile;
  members?: TeamMember[];
}

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  position_in_round: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  next_match_id: string | null;
  team_a?: Team | null;
  team_b?: Team | null;
  winner?: Team | null;
}

export interface FaceitPlayerLookup {
  steam_id: string;
  faceit_nickname: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
  avatar?: string | null;
  not_found?: boolean;
  error?: string | null;
}

export interface LfgRequest {
  id: string;
  tournament_id: string;
  user_id: string;
  nickname: string;
  discord_tag: string;
  steam_id?: string | null;
  faceit_elo?: number | null;
  faceit_level?: number | null;
  role: string;
  description?: string | null;
  created_at: string;
  user?: Profile;
}

export type JoinRequestType = 'invite' | 'application';
export type JoinRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface TeamJoinRequest {
  id: string;
  tournament_id: string;
  team_id: string;
  user_id: string;
  type: JoinRequestType;
  status: JoinRequestStatus;
  nickname: string;
  steam_id: string;
  faceit_elo?: number | null;
  faceit_level?: number | null;
  role?: string | null;
  message?: string | null;
  created_at: string;
  updated_at?: string;
  team?: Team;
  user?: Profile;
}

export interface TournamentBlacklistEntry {
  id: string;
  user_id?: string | null;
  steam_id?: string | null;
  discord_username?: string | null;
  reason?: string | null;
  tournament_id?: string | null; // null = global ban
  banned_by: string;
  created_at: string;
  user?: Profile;
  banner?: Profile;
}

