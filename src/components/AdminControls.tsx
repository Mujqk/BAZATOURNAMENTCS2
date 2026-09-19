import React, { useState } from 'react';
import type { Tournament, Team } from '../types/database.types';
import {
  generateBracket,
  openRegistrationManually,
  closeRegistrationManually,
  resetTournamentBracket
} from '../lib/supabase';
import { Shield, Play, Lock, Unlock, RotateCcw, Shuffle, BarChart3, AlertCircle, Settings } from 'lucide-react';
import { AdminEditTournamentModal } from './AdminEditTournamentModal';

interface AdminControlsProps {
  tournament: Tournament;
  teams: Team[];
  onRefresh: () => void;
  onDeleted?: () => void;
}

export const AdminControls: React.FC<AdminControlsProps> = ({
  tournament,
  teams,
  onRefresh,
  onDeleted,
}) => {
  const [seedType, setSeedType] = useState<'random' | 'faceit_elo'>('random');
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleGenerateBracket = async () => {
    if (teams.length < 2) {
      setActionError('Необходимо как минимум 2 зарегистрированные команды для генерации сетки.');
      return;
    }

    setIsLoading(true);
    setActionError(null);
    try {
      await generateBracket(tournament.id, seedType);
      onRefresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRegistration = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      await openRegistrationManually(tournament.id);
      onRefresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseRegistration = async () => {
    if (!confirm('Вы уверены, что хотите закрыть регистрацию? Новые команды не смогут подавать заявки.')) return;
    setIsLoading(true);
    setActionError(null);
    try {
      await closeRegistrationManually(tournament.id);
      onRefresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetBracket = async () => {
    if (!confirm('Внимание: Сетка и все результаты матчей будут удалены! Вы уверены?')) return;
    setIsLoading(true);
    setActionError(null);
    try {
      await resetTournamentBracket(tournament.id);
      onRefresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const isOngoing = tournament.status === 'in_progress' || tournament.status === 'completed';
  const canGenerate = !isOngoing;

  return (
    <div
      style={{
        background: 'rgba(208, 188, 255, 0.05)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={20} color="var(--md-primary)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Панель администратора
          </span>
          <span className="badge badge-upcoming" style={{ fontSize: '0.75rem' }}>
            {teams.length} / {tournament.bracket_size} команд
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditModal(true)}
            title="Редактировать параметры турнира или удалить"
          >
            <Settings size={14} />
            Редактировать турнир
          </button>

          {tournament.status === 'registration_open' ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCloseRegistration}
              disabled={isLoading}
            >
              <Lock size={14} />
              Закрыть регистрацию
            </button>
          ) : !isOngoing ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenRegistration}
              disabled={isLoading}
            >
              <Unlock size={14} />
              Открыть регистрацию сейчас
            </button>
          ) : null}
        </div>
      </div>

      {showEditModal && (
        <AdminEditTournamentModal
          tournament={tournament}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => {
            setShowEditModal(false);
            onRefresh();
          }}
          onDeleted={() => {
            setShowEditModal(false);
            if (onDeleted) onDeleted();
          }}
        />
      )}

      {actionError && (
        <div className="alert-box alert-error" style={{ padding: '0.6rem 0.9rem' }}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Bracket Generation Controls */}
      {canGenerate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1.2rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Посев команд:</span>
            <button
              className={`btn btn-sm ${seedType === 'random' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSeedType('random')}
            >
              <Shuffle size={13} />
              Случайный
            </button>
            <button
              className={`btn btn-sm ${seedType === 'faceit_elo' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSeedType('faceit_elo')}
            >
              <BarChart3 size={13} />
              По Faceit ELO
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerateBracket}
            disabled={isLoading || teams.length < 2}
            style={{ marginLeft: 'auto' }}
          >
            <Play size={16} />
            Сформировать сетку и начать
          </button>
        </div>
      )}

      {/* When In Progress */}
      {isOngoing && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>
            {tournament.status === 'in_progress'
              ? 'Турнир активен. Кликайте по командам в сетке ниже, чтобы продвигать победителей в следующий раунд.'
              : 'Турнир завершен. Все победители определены.'}
          </span>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleResetBracket}
            disabled={isLoading}
          >
            <RotateCcw size={14} />
            Сбросить сетку
          </button>
        </div>
      )}
    </div>
  );
};
