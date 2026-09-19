import React, { useState } from 'react';
import type { Tournament, Team, Profile } from '../types/database.types';
import { createTeamJoinRequest } from '../lib/supabase';
import { lookupFaceitPlayer } from '../lib/faceit';
import { FaceitBadge } from './FaceitBadge';
import { UserPlus, AlertCircle, Check, Loader2, X, Search } from 'lucide-react';

interface TeamApplicationModalProps {
  tournament: Tournament;
  team: Team;
  currentUser: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

export const TeamApplicationModal: React.FC<TeamApplicationModalProps> = ({
  tournament,
  team,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [steamId, setSteamId] = useState('');
  const [nickname, setNickname] = useState(currentUser.discord_username || '');
  const [role, setRole] = useState('Любая');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingFaceit, setIsCheckingFaceit] = useState(false);
  const [faceitLevel, setFaceitLevel] = useState<number | null>(null);
  const [faceitElo, setFaceitElo] = useState<number | null>(null);
  const [faceitNick, setFaceitNick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSteamBlur = async () => {
    const clean = steamId.trim();
    if (clean.length === 17 && /^\d+$/.test(clean)) {
      setIsCheckingFaceit(true);
      try {
        const data = await lookupFaceitPlayer(clean);
        if (data.faceit_level) setFaceitLevel(data.faceit_level);
        if (data.faceit_elo) setFaceitElo(data.faceit_elo);
        if (data.faceit_nickname) {
          setFaceitNick(data.faceit_nickname);
          if (!nickname || nickname === currentUser.discord_username) {
            setNickname(data.faceit_nickname);
          }
        }
      } catch {
        // Faceit lookup not found or failed, ignore
      } finally {
        setIsCheckingFaceit(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSteam = steamId.trim();
    if (!cleanSteam || !/^\d{17}$/.test(cleanSteam)) {
      setError('Пожалуйста, укажите корректный SteamID64 (17 цифр).');
      return;
    }

    if (!nickname.trim()) {
      setError('Пожалуйста, укажите игровой никнейм.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createTeamJoinRequest({
        tournament_id: tournament.id,
        team_id: team.id,
        user_id: currentUser.id,
        type: 'application',
        nickname: nickname.trim(),
        steam_id: cleanSteam,
        faceit_level: faceitLevel,
        faceit_elo: faceitElo,
        role,
        message: message.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  const maxMembers = tournament.format === '1x1' ? 1 : tournament.format === '2x2' ? 2 : 5;
  const currentMembersCount = team.members ? team.members.length : 1;

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <UserPlus size={20} color="var(--md-primary)" />
            Подать заявку в команду
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.4rem' }}
            disabled={isSubmitting}
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--md-success)',
              }}
            >
              <Check size={28} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Заявка успешно отправлена!
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
              Капитан команды <strong>{team.name}</strong> получил ваше досье и примет решение о зачислении в состав.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div className="alert-box alert-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Target Team Card Info */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Целевая команда:</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {team.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Капитан: {team.captain?.discord_username || 'Не указан'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-format" style={{ fontSize: '0.75rem' }}>
                    {currentMembersCount} из {maxMembers} мест
                  </span>
                </div>
              </div>

              {/* SteamID Field */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    Ваш SteamID64 (17 цифр) <span style={{ color: 'var(--accent-orange)' }}>*</span>
                  </span>
                  {isCheckingFaceit && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--md-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Loader2 size={12} className="spin-animate" /> Проверка Faceit...
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="76561198000000000"
                    value={steamId}
                    onChange={(e) => setSteamId(e.target.value.replace(/\D/g, ''))}
                    onBlur={handleSteamBlur}
                    maxLength={17}
                    required
                  />
                  {steamId.length === 17 && (
                    <button
                      type="button"
                      onClick={handleSteamBlur}
                      className="btn btn-secondary btn-sm"
                      style={{ position: 'absolute', right: '4px', top: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      title="Проверить Faceit"
                    >
                      <Search size={12} /> Найти
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Используется для проверки на турнире и зачисления в команду.
                </span>
              </div>

              {/* Faceit dossier preview */}
              {faceitLevel !== null && faceitElo !== null && (
                <div
                  style={{
                    background: 'rgba(255, 85, 0, 0.08)',
                    border: '1px solid rgba(255, 85, 0, 0.25)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FaceitBadge level={faceitLevel} elo={faceitElo} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {faceitNick || nickname}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#ff7733', fontWeight: 600 }}>
                    Faceit профиль привязан
                  </span>
                </div>
              )}

              {/* Nickname Field */}
              <div className="form-group">
                <label className="form-label">
                  Игровой никнейм <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="s1mple, m0NESY..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>

              {/* Role Preference */}
              <div className="form-group">
                <label className="form-label">Желаемая роль в составе</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Любая">Любая роль</option>
                  <option value="Снайпер (AWP)">Снайпер (AWP)</option>
                  <option value="Рифлер / Энтри">Рифлер / Энтри-фраггер</option>
                  <option value="Капитан (IGL)">Капитан (IGL)</option>
                  <option value="Саппорт / Опорник">Саппорт / Опорник</option>
                </select>
              </div>

              {/* Message to Captain */}
              <div className="form-group">
                <label className="form-label">Сообщение капитану (необязательно)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Расскажите о своем опыте, прайм-тайме или готовности к тренировкам..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || steamId.length !== 17 || !nickname.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin-animate" />
                    Отправка заявки...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Отправить заявку капитану
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
