import React, { useState } from 'react';
import type { Match, Team } from '../types/database.types';
import { Edit2 } from 'lucide-react';
import { FaceitBadge } from './FaceitBadge';

interface MatchNodeProps {
  match: Match;
  canManage: boolean;
  onAdvanceWinner?: (matchId: string, winnerId: string, scoreA: number, scoreB: number) => Promise<void>;
}

export const MatchNode: React.FC<MatchNodeProps> = ({
  match,
  canManage,
  onAdvanceWinner,
}) => {
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [scoreA, setScoreA] = useState(match.score_a || 0);
  const [scoreB, setScoreB] = useState(match.score_b || 0);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(match.winner_id);
  const [isSaving, setIsSaving] = useState(false);

  const teamA = match.team_a;
  const teamB = match.team_b;
  const hasTeams = Boolean(teamA && teamB);
  const isCompleted = Boolean(match.winner_id);

  const handlePickWinner = async (winnerTeam: Team) => {
    if (!canManage || !onAdvanceWinner) return;

    if (!isEditingScore && !isCompleted) {
      // Direct 1-click advance
      try {
        setIsSaving(true);
        const winScore = 16;
        const loseScore = 10;
        const sA = winnerTeam.id === teamA?.id ? winScore : loseScore;
        const sB = winnerTeam.id === teamB?.id ? winScore : loseScore;
        await onAdvanceWinner(match.id, winnerTeam.id, sA, sB);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setIsSaving(false);
      }
    } else {
      setSelectedWinnerId(winnerTeam.id);
    }
  };

  const handleSaveScoreForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !onAdvanceWinner || !selectedWinnerId) return;

    try {
      setIsSaving(true);
      await onAdvanceWinner(match.id, selectedWinnerId, scoreA, scoreB);
      setIsEditingScore(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const getTeamAvgFaceit = (team?: Team | null) => {
    if (!team?.members || team.members.length === 0) return null;
    const lvls = team.members.map((m) => m.faceit_level).filter((l): l is number => l !== null);
    if (lvls.length === 0) return null;
    return Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length);
  };

  return (
    <div className={`match-node ${isCompleted ? 'completed' : ''}`}>
      {/* Team A Row */}
      <div
        className={`match-team ${
          match.winner_id === teamA?.id
            ? 'winner'
            : match.winner_id
            ? 'loser'
            : ''
        } ${canManage && teamA ? 'clickable-winner' : ''}`}
        onClick={() => teamA && handlePickWinner(teamA)}
        title={canManage && teamA && !isCompleted ? 'Кликните, чтобы отметить победителем' : undefined}
      >
        <div className="team-left">
          <span className="team-seed">
            {teamA?.bracket_position ? `#${teamA.bracket_position}` : ''}
          </span>
          <span className="team-name">
            {teamA ? teamA.name : <span style={{ color: 'var(--text-muted)' }}>TBD</span>}
          </span>
          {teamA && <FaceitBadge level={getTeamAvgFaceit(teamA)} showElo={false} />}
        </div>
        <div className="team-score-badge">
          {match.score_a ?? 0}
        </div>
      </div>

      {/* Team B Row */}
      <div
        className={`match-team ${
          match.winner_id === teamB?.id
            ? 'winner'
            : match.winner_id
            ? 'loser'
            : ''
        } ${canManage && teamB ? 'clickable-winner' : ''}`}
        onClick={() => teamB && handlePickWinner(teamB)}
        title={canManage && teamB && !isCompleted ? 'Кликните, чтобы отметить победителем' : undefined}
      >
        <div className="team-left">
          <span className="team-seed">
            {teamB?.bracket_position ? `#${teamB.bracket_position}` : ''}
          </span>
          <span className="team-name">
            {teamB ? teamB.name : <span style={{ color: 'var(--text-muted)' }}>TBD</span>}
          </span>
          {teamB && <FaceitBadge level={getTeamAvgFaceit(teamB)} showElo={false} />}
        </div>
        <div className="team-score-badge">
          {match.score_b ?? 0}
        </div>
      </div>

      {/* Footer / Admin controls */}
      <div className="match-footer">
        <span>Матч #{match.position_in_round} (Р{match.round})</span>

        {canManage && hasTeams && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
              onClick={() => setIsEditingScore(!isEditingScore)}
              title="Вручную ввести точный счёт"
            >
              <Edit2 size={12} />
              Счёт
            </button>
          </div>
        )}
      </div>

      {/* Admin Manual Score Modal/Form */}
      {isEditingScore && (
        <form
          onSubmit={handleSaveScoreForm}
          style={{
            background: 'rgba(10, 14, 22, 0.95)',
            padding: '0.75rem',
            borderTop: '1px solid var(--border-accent)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', fontWeight: 600 }}>
            Выберите победителя и введите счет:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{teamA?.name}:</span>
              <input
                type="number"
                min="0"
                max="99"
                className="form-input"
                style={{ padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                value={scoreA}
                onChange={(e) => setScoreA(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <span style={{ color: 'var(--text-muted)' }}>:</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{teamB?.name}:</span>
              <input
                type="number"
                min="0"
                max="99"
                className="form-input"
                style={{ padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                value={scoreB}
                onChange={(e) => setScoreB(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedWinnerId === teamA?.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '0.25rem' }}
              onClick={() => teamA && setSelectedWinnerId(teamA.id)}
            >
              Победа {teamA?.name}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedWinnerId === teamB?.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '0.25rem' }}
              onClick={() => teamB && setSelectedWinnerId(teamB.id)}
            >
              Победа {teamB?.name}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditingScore(false)}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSaving || !selectedWinnerId}
            >
              {isSaving ? 'Сохранение...' : 'Применить'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
