import React, { useEffect } from 'react';
import type { Match, Tournament, Team } from '../types/database.types';
import { MatchNode } from './MatchNode';
import { Trophy, Crown, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BracketTreeProps {
  tournament: Tournament;
  matches: Match[];
  isAdmin: boolean;
  onAdvanceWinner: (matchId: string, winnerId: string, scoreA: number, scoreB: number) => Promise<void>;
}

export const BracketTree: React.FC<BracketTreeProps> = ({
  tournament,
  matches,
  isAdmin,
  onAdvanceWinner,
}) => {
  if (matches.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          border: '1px dashed var(--border-medium)',
        }}
      >
        <Trophy size={48} color="var(--accent-orange)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', textTransform: 'uppercase' }}>
          Сетка еще не сформирована
        </h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0.5rem auto 1.5rem', fontSize: '0.92rem' }}>
          {isAdmin
            ? 'Как только регистрация будет закрыта или наберется необходимое количество команд, вы сможете сгенерировать сетку с помощью панели управления выше.'
            : 'Организаторы турнира сформируют и опубликуют турнирную сетку перед началом матчей.'}
        </p>
      </div>
    );
  }

  // Determine total rounds
  const totalRounds = Math.max(...matches.map((m) => m.round));

  // Find final match and champion
  const finalMatch = matches.find((m) => m.round === totalRounds);
  const championTeam: Team | null = finalMatch?.winner || null;

  useEffect(() => {
    if (championTeam && tournament.status === 'completed') {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff8e00', '#00d0ff', '#ffd700', '#ffffff'],
        });
      } catch (e) {
        // ignore if blocked in some environments
      }
    }
  }, [championTeam, tournament.status]);

  // Generate round names
  const getRoundTitle = (round: number, maxRound: number) => {
    const diffFromFinal = maxRound - round;
    if (diffFromFinal === 0) return 'ГРАНД-ФИНАЛ';
    if (diffFromFinal === 1) return 'ПОЛУФИНАЛ';
    if (diffFromFinal === 2) return '1/4 ФИНАЛА';
    if (diffFromFinal === 3) return '1/8 ФИНАЛА';
    if (diffFromFinal === 4) return '1/16 ФИНАЛА';
    return `РАУНД ${round}`;
  };

  // Group matches by round
  const roundsArray = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Champion Banner */}
      {championTeam && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 142, 0, 0.15) 0%, rgba(255, 215, 0, 0.1) 100%)',
            border: '1px solid #ffd700',
            borderRadius: '12px',
            padding: '1.25rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            boxShadow: '0 0 25px rgba(255, 215, 0, 0.25)',
            textAlign: 'center',
          }}
        >
          <Crown size={36} color="#ffd700" />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#ffd700', letterSpacing: '0.1em' }}>
              ЧЕМПИОН ТУРНИРА
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
              {championTeam.name}
            </div>
          </div>
          <Sparkles size={32} color="#ffd700" />
        </div>
      )}

      {/* Interactive Bracket Grid */}
      <div className="bracket-section">
        <div className="bracket-container">
          {roundsArray.map((roundNum) => {
            const roundMatches = matches
              .filter((m) => m.round === roundNum)
              .sort((a, b) => a.position_in_round - b.position_in_round);

            return (
              <div key={roundNum} className="bracket-round">
                <div className="round-header">
                  {getRoundTitle(roundNum, totalRounds)}
                </div>
                <div className="round-matches">
                  {roundMatches.map((m) => (
                    <MatchNode
                      key={m.id}
                      match={m}
                      canManage={isAdmin && tournament.status === 'in_progress'}
                      onAdvanceWinner={onAdvanceWinner}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
