/**
 * Utility for formatting ISO timestamps adaptively into the user's local timezone.
 * When an admin sets 21:00 MSK (UTC+3), Supabase stores it in UTC.
 * A viewer in Vladivostok (UTC+10) or London (UTC+0) will automatically see
 * the tournament start time according to their local device time, plus a timezone hint.
 */
export function formatTournamentDateTime(isoString: string): {
  formatted: string;
  timeOnly: string;
  dateOnly: string;
  tzName: string;
  fullWithTz: string;
} {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return {
        formatted: isoString,
        timeOnly: '',
        dateOnly: '',
        tzName: '',
        fullWithTz: isoString,
      };
    }

    // Localized date
    const dateOnly = date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });

    // Localized time
    const timeOnly = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Local timezone abbreviation / city
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shortTz = getShortTimeZone(date);

    const formatted = `${dateOnly}, ${timeOnly}`;
    const fullWithTz = `${formatted} (${shortTz})`;

    return {
      formatted,
      timeOnly,
      dateOnly,
      tzName: timeZone,
      fullWithTz,
    };
  } catch {
    return {
      formatted: isoString,
      timeOnly: '',
      dateOnly: '',
      tzName: '',
      fullWithTz: isoString,
    };
  }
}

function getShortTimeZone(date: Date): string {
  try {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const mins = Math.abs(offsetMinutes) % 60;
    const offsetStr = `UTC${sign}${hours}${mins > 0 ? `:${mins}` : ''}`;

    // Common Russian aliases
    if (offsetMinutes === 180) return 'МСК / UTC+3';
    if (offsetMinutes === 300) return 'UTC+5 (Екатеринбург)';
    if (offsetMinutes === 420) return 'UTC+7 (Красноярск)';

    return offsetStr;
  } catch {
    return 'местное время';
  }
}

/**
 * Dynamically computes the effective tournament status based on schedule timestamps.
 * If registration_start has arrived and tournament hasn't started, registration is open!
 */
export function getEffectiveTournamentStatus(tournament: {
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  registration_start: string;
  tournament_start: string;
}): 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled' {
  if (tournament.status === 'completed' || tournament.status === 'cancelled') {
    return tournament.status;
  }
  if (tournament.status === 'in_progress') {
    return 'in_progress';
  }
  if (tournament.status === 'registration_closed') {
    return 'registration_closed';
  }

  const now = new Date();
  const regStart = new Date(tournament.registration_start);
  const tournStart = new Date(tournament.tournament_start);

  if (now >= tournStart) {
    return 'registration_closed';
  }

  if (now >= regStart || tournament.status === 'registration_open') {
    return 'registration_open';
  }

  return 'upcoming';
}

