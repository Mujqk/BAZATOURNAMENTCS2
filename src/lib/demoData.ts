import type { Tournament, Team, Match, Profile } from '../types/database.types';

export const DEMO_ADMIN_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  discord_id: '123456789012345678',
  discord_username: 'MajorOrganizer',
  avatar_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
  is_admin: true,
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export const DEMO_PLAYER_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  discord_id: '876543210987654321',
  discord_username: 'AwpMaster_CS',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  is_admin: false,
  created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
};

export const INITIAL_DEMO_TOURNAMENTS: Tournament[] = [
  {
    id: 't-101',
    title: 'CS2 Mirage Showdown 1x1 Aim King',
    description: 'Локальная битва снайперов и аимеров сообщества на aim_map и Mirage Mid. Олимпийская сетка на 8 участников.',
    format: '1x1',
    bracket_size: 8,
    registration_start: new Date(Date.now() - 2 * 86400000).toISOString(),
    tournament_start: new Date(Date.now() + 1 * 86400000).toISOString(),
    status: 'in_progress',
    created_by: DEMO_ADMIN_PROFILE.id,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    creator: DEMO_ADMIN_PROFILE,
    teams_count: 8,
  },
  {
    id: 't-102',
    title: 'CS2 Dust2 Duo Cup 2x2',
    description: 'Турнир двоек CS2 на коротких картах (Shortdust, Inferno Wingman). Открыта регистрация для всех участников Discord!',
    format: '2x2',
    bracket_size: 8,
    registration_start: new Date(Date.now() - 1 * 86400000).toISOString(),
    tournament_start: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: 'registration_open',
    created_by: DEMO_ADMIN_PROFILE.id,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    creator: DEMO_ADMIN_PROFILE,
    teams_count: 5,
  },
  {
    id: 't-103',
    title: 'CS2 Autumn Major 5x5 Community Cup',
    description: 'Главный командный турнир осени. Сетка на 16 команд, Bo1 до полуфинала, финал Bo3.',
    format: '5x5',
    bracket_size: 16,
    registration_start: new Date(Date.now() + 2 * 86400000).toISOString(),
    tournament_start: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'upcoming',
    created_by: DEMO_ADMIN_PROFILE.id,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    creator: DEMO_ADMIN_PROFILE,
    teams_count: 0,
  },
  {
    id: 't-104',
    title: 'CS2 Night Cup 1x1 Flash Series #1',
    description: 'Завершенный ночной турнир снайперов. Победитель получил роль Чемпиона на сервере Discord.',
    format: '1x1',
    bracket_size: 4,
    registration_start: new Date(Date.now() - 7 * 86400000).toISOString(),
    tournament_start: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: 'completed',
    created_by: DEMO_ADMIN_PROFILE.id,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    creator: DEMO_ADMIN_PROFILE,
    teams_count: 4,
  }
];

export const INITIAL_DEMO_TEAMS: Team[] = [
  {
    id: 'team-1',
    tournament_id: 't-101',
    name: 'donk_peeker',
    captain_id: 'p-1',
    bracket_position: 1,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-1', team_id: 'team-1', steam_id: '76561198000000001',
      faceit_nickname: 'donk_peeker', faceit_level: 10, faceit_elo: 3120, is_captain: true
    }]
  },
  {
    id: 'team-2',
    tournament_id: 't-101',
    name: 's1mple_reborn',
    captain_id: 'p-2',
    bracket_position: 2,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-2', team_id: 'team-2', steam_id: '76561198000000002',
      faceit_nickname: 's1mple_reborn', faceit_level: 10, faceit_elo: 2890, is_captain: true
    }]
  },
  {
    id: 'team-3',
    tournament_id: 't-101',
    name: 'm0nesy_flick',
    captain_id: 'p-3',
    bracket_position: 3,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-3', team_id: 'team-3', steam_id: '76561198000000003',
      faceit_nickname: 'm0nesy_flick', faceit_level: 9, faceit_elo: 2310, is_captain: true
    }]
  },
  {
    id: 'team-4',
    tournament_id: 't-101',
    name: 'b1t_headshot',
    captain_id: 'p-4',
    bracket_position: 4,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-4', team_id: 'team-4', steam_id: '76561198000000004',
      faceit_nickname: 'b1t_headshot', faceit_level: 8, faceit_elo: 2045, is_captain: true
    }]
  },
  {
    id: 'team-5',
    tournament_id: 't-101',
    name: 'zywoo_clutch',
    captain_id: 'p-5',
    bracket_position: 5,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-5', team_id: 'team-5', steam_id: '76561198000000005',
      faceit_nickname: 'zywoo_clutch', faceit_level: 10, faceit_elo: 3010, is_captain: true
    }]
  },
  {
    id: 'team-6',
    tournament_id: 't-101',
    name: 'niko_deagle',
    captain_id: 'p-6',
    bracket_position: 6,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-6', team_id: 'team-6', steam_id: '76561198000000006',
      faceit_nickname: 'niko_deagle', faceit_level: 9, faceit_elo: 2420, is_captain: true
    }]
  },
  {
    id: 'team-7',
    tournament_id: 't-101',
    name: 'ropz_lurk',
    captain_id: 'p-7',
    bracket_position: 7,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-7', team_id: 'team-7', steam_id: '76561198000000007',
      faceit_nickname: 'ropz_lurk', faceit_level: 7, faceit_elo: 1850, is_captain: true
    }]
  },
  {
    id: 'team-8',
    tournament_id: 't-101',
    name: 'kyousuke_aim',
    captain_id: 'p-8',
    bracket_position: 8,
    created_at: new Date().toISOString(),
    members: [{
      id: 'm-8', team_id: 'team-8', steam_id: '76561198000000008',
      faceit_nickname: 'kyousuke_aim', faceit_level: 6, faceit_elo: 1560, is_captain: true
    }]
  },
  {
    id: 'team-duo-1',
    tournament_id: 't-102',
    name: 'Cyber Cobras',
    captain_id: 'p-10',
    bracket_position: null,
    created_at: new Date().toISOString(),
    members: [
      { id: 'dm-1', team_id: 'team-duo-1', steam_id: '76561198000000010', faceit_nickname: 'CobraCaptain', faceit_level: 9, faceit_elo: 2280, is_captain: true },
      { id: 'dm-2', team_id: 'team-duo-1', steam_id: '76561198000000011', faceit_nickname: 'ViperGunner', faceit_level: 8, faceit_elo: 2020, is_captain: false }
    ]
  },
  {
    id: 'team-duo-2',
    tournament_id: 't-102',
    name: 'Inferno Kings',
    captain_id: 'p-12',
    bracket_position: null,
    created_at: new Date().toISOString(),
    members: [
      { id: 'dm-3', team_id: 'team-duo-2', steam_id: '76561198000000012', faceit_nickname: 'BananaHold', faceit_level: 10, faceit_elo: 2750, is_captain: true },
      { id: 'dm-4', team_id: 'team-duo-2', steam_id: '76561198000000013', faceit_nickname: 'PitDemon', faceit_level: 7, faceit_elo: 1780, is_captain: false }
    ]
  }
];

export const INITIAL_DEMO_MATCHES: Match[] = [
  {
    id: 'm-1-1',
    tournament_id: 't-101',
    round: 1,
    position_in_round: 1,
    team_a_id: 'team-1',
    team_b_id: 'team-2',
    score_a: 16,
    score_b: 13,
    winner_id: 'team-1',
    next_match_id: 'm-2-1'
  },
  {
    id: 'm-1-2',
    tournament_id: 't-101',
    round: 1,
    position_in_round: 2,
    team_a_id: 'team-3',
    team_b_id: 'team-4',
    score_a: 14,
    score_b: 16,
    winner_id: 'team-4',
    next_match_id: 'm-2-1'
  },
  {
    id: 'm-1-3',
    tournament_id: 't-101',
    round: 1,
    position_in_round: 3,
    team_a_id: 'team-5',
    team_b_id: 'team-6',
    score_a: 16,
    score_b: 9,
    winner_id: 'team-5',
    next_match_id: 'm-2-2'
  },
  {
    id: 'm-1-4',
    tournament_id: 't-101',
    round: 1,
    position_in_round: 4,
    team_a_id: 'team-7',
    team_b_id: 'team-8',
    score_a: 11,
    score_b: 16,
    winner_id: 'team-8',
    next_match_id: 'm-2-2'
  },
  {
    id: 'm-2-1',
    tournament_id: 't-101',
    round: 2,
    position_in_round: 1,
    team_a_id: 'team-1',
    team_b_id: 'team-4',
    score_a: 16,
    score_b: 10,
    winner_id: 'team-1',
    next_match_id: 'm-3-1'
  },
  {
    id: 'm-2-2',
    tournament_id: 't-101',
    round: 2,
    position_in_round: 2,
    team_a_id: 'team-5',
    team_b_id: 'team-8',
    score_a: 0,
    score_b: 0,
    winner_id: null,
    next_match_id: 'm-3-1'
  },
  {
    id: 'm-3-1',
    tournament_id: 't-101',
    round: 3,
    position_in_round: 1,
    team_a_id: 'team-1',
    team_b_id: null,
    score_a: 0,
    score_b: 0,
    winner_id: null,
    next_match_id: null
  }
];
