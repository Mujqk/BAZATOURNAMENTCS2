import type { FaceitPlayerLookup } from '../types/database.types';

const FACEIT_API_KEY = import.meta.env.VITE_FACEIT_API_KEY || '01445922-faa3-4462-b6c5-e41c6c05a04b';

export async function lookupFaceitPlayer(steamId: string): Promise<FaceitPlayerLookup> {
  const trimmed = steamId.trim();

  // Validate SteamID64 format (17 digits starting with 7656)
  if (!/^\d{17}$/.test(trimmed)) {
    return {
      steam_id: trimmed,
      faceit_nickname: null,
      faceit_level: null,
      faceit_elo: null,
      error: 'SteamID64 должен состоять ровно из 17 цифр (начинается на 7656...)',
    };
  }

  // Query real Faceit Open Data API v4 directly
  try {
    const res = await fetch(
      `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${trimmed}`,
      {
        headers: {
          Authorization: `Bearer ${FACEIT_API_KEY}`,
          Accept: 'application/json',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const cs2 = data.games?.cs2;
      const csgo = data.games?.csgo;
      const gameData = cs2 || csgo;

      const rawElo = gameData?.faceit_elo ?? 0;
      const rawLevel = gameData?.skill_level ?? 0;

      // Real Faceit nickname: use account nickname or in-game nickname
      const nickname = data.nickname || gameData?.game_player_name || data.steam_nickname || `Steam_${trimmed.slice(-4)}`;

      // If registered on Faceit but hasn't played calibration yet (skill_level 0), level is 1
      const level = rawLevel > 0 ? rawLevel : (rawElo > 0 ? getLevelFromElo(rawElo) : 1);
      const elo = rawElo > 0 ? rawElo : 0;

      return {
        steam_id: trimmed,
        faceit_nickname: nickname,
        faceit_level: level,
        faceit_elo: elo,
      };
    }

    // Try fallback to csgo game identifier if cs2 wasn't registered yet
    const resCsgo = await fetch(
      `https://open.faceit.com/data/v4/players?game=csgo&game_player_id=${trimmed}`,
      {
        headers: {
          Authorization: `Bearer ${FACEIT_API_KEY}`,
          Accept: 'application/json',
        },
      }
    );

    if (resCsgo.ok) {
      const data = await resCsgo.json();
      const csgo = data.games?.csgo;
      const rawElo = csgo?.faceit_elo ?? 0;
      const rawLevel = csgo?.skill_level ?? 0;

      return {
        steam_id: trimmed,
        faceit_nickname: data.nickname || csgo?.game_player_name || data.steam_nickname,
        faceit_level: rawLevel > 0 ? rawLevel : 1,
        faceit_elo: rawElo,
      };
    }

    if (res.status === 404) {
      return {
        steam_id: trimmed,
        faceit_nickname: null,
        faceit_level: null,
        faceit_elo: null,
        error: 'Игрок с таким SteamID не найден на Faceit. Проверьте правильность SteamID64.',
      };
    }
  } catch (err) {
    console.error('Faceit API direct lookup error:', err);
  }

  return {
    steam_id: trimmed,
    faceit_nickname: null,
    faceit_level: null,
    faceit_elo: null,
    error: 'Не удалось получить данные с Faceit. Проверьте подключение к сети.',
  };
}

function getLevelFromElo(elo: number): number {
  if (elo >= 2001) return 10;
  if (elo >= 1751) return 9;
  if (elo >= 1531) return 8;
  if (elo >= 1351) return 7;
  if (elo >= 1201) return 6;
  if (elo >= 1051) return 5;
  if (elo >= 901) return 4;
  if (elo >= 751) return 3;
  if (elo >= 501) return 2;
  return 1;
}
