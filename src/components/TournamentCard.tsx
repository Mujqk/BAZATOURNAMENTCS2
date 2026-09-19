import React from 'react';
import type { Tournament } from '../types/database.types';
import { Calendar, Users, ChevronRight } from 'lucide-react';
import { formatTournamentDateTime, getEffectiveTournamentStatus } from '../lib/dateUtils';

interface TournamentCardProps {
  tournament: Tournament;
  onSelect: (tournamentId: string) => void;
  onRegisterClick?: (tournament: Tournament) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onSelect,
  onRegisterClick,
}) => {
  const formatStatus = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return { label: 'Скоро', class: 'badge-upcoming' };
      case 'registration_open':
        return { label: 'Регистрация открыта', class: 'badge-registration_open' };
      case 'registration_closed':
        return { label: 'Регистрация закрыта', class: 'badge-registration_closed' };
      case 'in_progress':
        return { label: 'Идет турнир', class: 'badge-in_progress' };
      case 'completed':
        return { label: 'Завершен', class: 'badge-completed' };
      case 'cancelled':
        return { label: 'Отменен', class: 'badge-upcoming' };
    }
  };

  const effectiveStatus = getEffectiveTournamentStatus(tournament);
  const statusInfo = formatStatus(effectiveStatus);
  const teamsCount = tournament.teams_count || 0;
  const isFull = teamsCount >= tournament.bracket_size;
  const progressPercent = Math.min(100, Math.round((teamsCount / tournament.bracket_size) * 100));

  const startInfo = formatTournamentDateTime(tournament.tournament_start);

  return (
    <div className="tournament-card">
      <div className="card-top">
        <div className="card-badges">
          <span className="badge badge-format">CS2 {tournament.format}</span>
          <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
          {tournament.prize_first && (
            <span className="badge" style={{ background: 'rgba(255, 215, 0, 0.12)', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.3)' }}>
              1-е место: {tournament.prize_first}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          {tournament.bracket_size} СЛОТОВ
        </span>
      </div>

      <div>
        <h3 className="card-title" onClick={() => onSelect(tournament.id)} style={{ cursor: 'pointer' }}>
          {tournament.title}
        </h3>
        {tournament.description && (
          <p className="card-desc" style={{ marginTop: '0.35rem' }}>
            {tournament.description}
          </p>
        )}
      </div>

      <div className="card-meta-grid">
        <div className="meta-item">
          <span className="meta-label">Старт турнира</span>
          <span className="meta-value">
            <Calendar size={13} color="var(--md-primary)" />
            {startInfo.formatted}
          </span>
          <span className="tz-hint">{startInfo.tzName.split('/').pop()?.replace('_', ' ')}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Регистрация</span>
          <span className="meta-value">
            <Users size={13} color="var(--md-secondary)" />
            {teamsCount} / {tournament.bracket_size}
          </span>
          <span className="tz-hint">{isFull ? 'Сетка заполнена' : 'Есть свободные слоты'}</span>
        </div>
      </div>

      <div className="slot-progress-wrapper">
        <div className="slot-progress-header">
          <span>Заполнение слотов</span>
          <span>{teamsCount}/{tournament.bracket_size} ({progressPercent}%)</span>
        </div>
        <div className="slot-progress-bar">
          <div
            className="slot-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="card-footer">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onSelect(tournament.id)}
        >
          Сетка и детали
          <ChevronRight size={14} />
        </button>

        {tournament.status === 'registration_open' && !isFull && onRegisterClick && (
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRegisterClick(tournament);
            }}
          >
            Подать заявку
          </button>
        )}
      </div>
    </div>
  );
};
