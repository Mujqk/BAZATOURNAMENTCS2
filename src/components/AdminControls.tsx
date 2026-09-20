import React, { useState } from 'react';
import type { Tournament, Team } from '../types/database.types';
import {
  generateBracket,
  openRegistrationManually,
  closeRegistrationManually,
  resetTournamentBracket
} from '../lib/supabase';
import {
  Shield,
  Play,
  Lock,
  Unlock,
  RotateCcw,
  Shuffle,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  Settings,
  CheckSquare,
  Square,
  X,
  Loader2,
  Ban
} from 'lucide-react';
import { AdminEditTournamentModal } from './AdminEditTournamentModal';
import { AdminBlacklistModal } from './AdminBlacklistModal';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const [seedType, setSeedType] = useState<'random' | 'faceit_elo'>('random');
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  // Double confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmStep1, setConfirmStep1] = useState(false);
  const [confirmStep2, setConfirmStep2] = useState(false);

  const handleOpenConfirmModal = () => {
    if (teams.length < 2) {
      setActionError('Необходимо как минимум 2 зарегистрированные команды для генерации сетки.');
      return;
    }
    setConfirmStep1(false);
    setConfirmStep2(false);
    setActionError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmGenerateBracket = async () => {
    if (!confirmStep1 || !confirmStep2) return;

    setIsLoading(true);
    setActionError(null);
    try {
      await generateBracket(tournament.id, seedType);
      setShowConfirmModal(false);
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
  const isFull = teams.length >= tournament.bracket_size;

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
          <span className={`badge ${isFull ? 'badge-completed' : 'badge-upcoming'}`} style={{ fontSize: '0.75rem' }}>
            {teams.length} / {tournament.bracket_size} команд {isFull ? '(Набор полон)' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBlacklistModal(true)}
            title="Черный список участников"
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)' }}
          >
            <Ban size={14} />
            Черный список
          </button>

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

      {showBlacklistModal && user && (
        <AdminBlacklistModal
          tournament={tournament}
          currentUser={user}
          onClose={() => setShowBlacklistModal(false)}
          onUpdated={onRefresh}
        />
      )}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.25)', padding: '1rem 1.25rem', borderRadius: '10px' }}>
          {!isFull && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.82rem',
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                Набор команд еще не завершен: собрано {teams.length} из {tournament.bracket_size}. Для досрочной генерации сетки потребуется двойное подтверждение.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Посев:</span>
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
              onClick={handleOpenConfirmModal}
              disabled={isLoading || teams.length < 2}
              title={teams.length < 2 ? 'Нужно минимум 2 команды для турнира' : 'Открыть двойное подтверждение генерации'}
              style={{ marginLeft: 'auto' }}
            >
              <Play size={16} />
              Сформировать сетку и начать
            </button>
          </div>
        </div>
      )}

      {/* Double Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => !isLoading && setShowConfirmModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
                Двойное подтверждение запуска сетки
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.4rem' }}
                disabled={isLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {actionError && (
                <div className="alert-box alert-error">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Status banner */}
              <div
                style={{
                  background: isFull ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${isFull ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Заполненность слотов:</span>
                  <span
                    className={isFull ? 'badge badge-completed' : 'badge badge-format'}
                    style={{ fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    {teams.length} из {tournament.bracket_size} команд
                  </span>
                </div>

                {!isFull && (
                  <p style={{ fontSize: '0.84rem', color: '#fbbf24', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                    Внимание: Собраны не все команды! В сетке появятся пустые слоты (автоматические проходы / BYE).
                  </p>
                )}
              </div>

              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Вы собираетесь закрыть регистрацию и запустить турнир. Выбран способ посева:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {seedType === 'random' ? 'Случайный посев' : 'Посев по Faceit ELO'}
                </strong>.
                Для предотвращения случайного запуска отметьте <strong>оба пункта подтверждения</strong>:
              </div>

              {/* Checkbox 1 */}
              <div
                onClick={() => !isLoading && setConfirmStep1(!confirmStep1)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: confirmStep1 ? 'rgba(208, 188, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${confirmStep1 ? 'var(--md-primary)' : 'var(--glass-border)'}`,
                  borderRadius: '10px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ marginTop: '2px', color: confirmStep1 ? 'var(--md-primary)' : 'var(--text-muted)' }}>
                  {confirmStep1 ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div style={{ fontSize: '0.86rem', color: confirmStep1 ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Подтверждение 1:</strong> Я проверил(а) список команд и подтверждаю, что регистрация на турнир окончательно закрывается.
                </div>
              </div>

              {/* Checkbox 2 */}
              <div
                onClick={() => !isLoading && setConfirmStep2(!confirmStep2)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: confirmStep2 ? 'rgba(208, 188, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${confirmStep2 ? 'var(--md-primary)' : 'var(--glass-border)'}`,
                  borderRadius: '10px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ marginTop: '2px', color: confirmStep2 ? 'var(--md-primary)' : 'var(--text-muted)' }}>
                  {confirmStep2 ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div style={{ fontSize: '0.86rem', color: confirmStep2 ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Подтверждение 2:</strong> Я осознанно подтверждаю генерацию турнирной сетки и старт матчей турнира {!isFull ? '(с неполным составом команд)' : ''}.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isLoading || !confirmStep1 || !confirmStep2}
                onClick={handleConfirmGenerateBracket}
                style={{
                  opacity: (!confirmStep1 || !confirmStep2) ? 0.5 : 1,
                  cursor: (!confirmStep1 || !confirmStep2) ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spin-animate" />
                    Генерация сетки...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Сформировать сетку и начать
                  </>
                )}
              </button>
            </div>
          </div>
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

