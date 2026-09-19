import React, { useState } from 'react';
import type { Tournament, FaceitPlayerLookup, Profile } from '../types/database.types';
import { lookupFaceitPlayer } from '../lib/faceit';
import { registerTeamAtomic } from '../lib/supabase';
import { FaceitBadge } from './FaceitBadge';
import { X, AlertCircle, Loader2, Users, Trophy } from 'lucide-react';

interface RegistrationModalProps {
  tournament: Tournament;
  currentUser: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

interface MemberFormState {
  steamId: string;
  nickname: string;
  isCaptain: boolean;
  lookup: FaceitPlayerLookup | null;
  isLoading: boolean;
  error: string | null;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  tournament,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const memberCount = tournament.format === '1x1' ? 1 : tournament.format === '2x2' ? 2 : 5;
  const is1x1 = tournament.format === '1x1';

  const [teamName, setTeamName] = useState(is1x1 ? currentUser.discord_username : '');
  const [members, setMembers] = useState<MemberFormState[]>(
    Array.from({ length: memberCount }, (_, i) => ({
      steamId: '',
      nickname: i === 0 ? currentUser.discord_username : '',
      isCaptain: i === 0,
      lookup: null,
      isLoading: false,
      error: null,
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Handle Nickname change
  const handleNicknameChange = (index: number, val: string) => {
    const updated = [...members];
    updated[index].nickname = val;
    setMembers(updated);
    if (is1x1 && index === 0) {
      setTeamName(val);
    }
  };

  // Handle Steam ID change & trigger Faceit lookup
  const handleSteamIdChange = async (index: number, val: string) => {
    const cleanVal = val.trim();
    const updated = [...members];
    updated[index].steamId = cleanVal;
    updated[index].error = null;
    setMembers(updated);

    // Auto-lookup when exactly 17 digits
    if (/^\d{17}$/.test(cleanVal)) {
      await performLookup(index, cleanVal);
    }
  };

  const performLookup = async (index: number, steamId: string) => {
    setMembers((prev) => {
      const u = [...prev];
      u[index].isLoading = true;
      u[index].error = null;
      return u;
    });

    try {
      const res = await lookupFaceitPlayer(steamId);
      setMembers((prev) => {
        const u = [...prev];
        u[index].isLoading = false;
        u[index].lookup = res;
        // Auto-fill nickname if field is currently empty or still default
        if (res.faceit_nickname && (!u[index].nickname || u[index].nickname === currentUser.discord_username)) {
          u[index].nickname = res.faceit_nickname;
          if (is1x1 && index === 0) {
            setTeamName(res.faceit_nickname);
          }
        }
        return u;
      });
    } catch {
      setMembers((prev) => {
        const u = [...prev];
        u[index].isLoading = false;
        return u;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validation: Team Name
    const finalTeamName = is1x1
      ? (teamName.trim() || members[0]?.nickname.trim() || currentUser.discord_username)
      : teamName.trim();

    if (!finalTeamName) {
      setFormError('Пожалуйста, укажите название команды / ваш никнейм');
      return;
    }

    // 2. Validation: Captain (member #0) is required
    const captain = members[0];
    if (!captain || !captain.steamId || !/^\d{17}$/.test(captain.steamId.trim())) {
      setFormError('Укажите корректный SteamID64 (17 цифр) для капитана');
      return;
    }
    if (!captain.nickname.trim()) {
      setFormError('Укажите никнейм капитана');
      return;
    }

    // Teammates (#1..N) are OPTIONAL for 2x2 and 5x5
    const filledTeammates: MemberFormState[] = [];
    for (let i = 1; i < members.length; i++) {
      const m = members[i];
      const hasSteam = Boolean(m.steamId && m.steamId.trim());
      const hasNick = Boolean(m.nickname && m.nickname.trim());

      if (hasSteam || hasNick) {
        if (!m.steamId || !/^\d{17}$/.test(m.steamId.trim())) {
          setFormError(`Укажите корректный SteamID64 (17 цифр) для игрока #${i + 1} или оставьте поле пустым`);
          return;
        }
        filledTeammates.push(m);
      }
    }

    const activeMembers = [captain, ...filledTeammates];

    // Check duplicate Steam IDs in the same team
    const steamIds = activeMembers.map((m) => m.steamId.trim());
    if (new Set(steamIds).size !== steamIds.length) {
      setFormError('В заявке не должно быть повторяющихся Steam ID');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadMembers = activeMembers.map((m, idx) => ({
        steam_id: m.steamId.trim(),
        faceit_nickname: m.nickname.trim() || m.lookup?.faceit_nickname || (m.isCaptain ? currentUser.discord_username : `Игрок ${idx + 1}`),
        faceit_level: m.lookup?.faceit_level || null,
        faceit_elo: m.lookup?.faceit_elo || null,
        is_captain: m.isCaptain,
      }));

      await registerTeamAtomic(tournament.id, finalTeamName, payloadMembers, currentUser);

      onSuccess();
      onClose();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Trophy size={20} color="#ff8e00" />
            Заявка на турнир {tournament.format}
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert-box alert-info">
              <Users size={18} style={{ flexShrink: 0 }} />
              <div>
                Капитан: <strong>{currentUser.discord_username}</strong>. Введите 17-значный SteamID64 каждого участника. Уровень Faceit определится автоматически.
              </div>
            </div>

            {formError && (
              <div className="alert-box alert-error">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <span>{is1x1 ? 'Ваш никнейм в турнире' : 'Название команды'}</span>
                <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={is1x1 ? "Например: s1mple, donk" : "Например: NAVI Junior, BAZA Team"}
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  if (is1x1 && members[0]) {
                    handleNicknameChange(0, e.target.value);
                  }
                }}
                maxLength={32}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {is1x1 ? 'Данные игрока' : `Состав команды (${members.length} сл.)`}
                </span>
                {!is1x1 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-primary)' }}>
                    Тимейтов можно добавить позже
                  </span>
                )}
              </div>

              {!is1x1 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(208, 188, 255, 0.06)', border: '1px solid rgba(208, 188, 255, 0.15)', padding: '0.55rem 0.85rem', borderRadius: '10px' }}>
                  Указывать тиммейтов сразу не обязательно — зарегистрируйте команду сейчас, а свободных игроков можно будет пригласить позже через вкладку «Поиск тиммейтов».
                </div>
              )}

              {members.map((m, idx) => (
                <div key={idx} className="member-input-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="member-input-header">
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {m.isCaptain ? 'Капитан (Вы)' : `Игрок #${idx + 1}`}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {m.isCaptain ? 'Лидер состава' : 'Участник'}
                    </span>
                  </div>

                  {/* Nickname input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Никнейм игрока {m.isCaptain ? <span style={{ color: 'var(--accent-orange)' }}>*</span> : <span style={{ color: 'var(--text-muted)' }}>(необязательно)</span>}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={m.isCaptain ? "Игровой никнейм" : "Можно оставить пустым"}
                      value={m.nickname}
                      onChange={(e) => handleNicknameChange(idx, e.target.value)}
                      maxLength={24}
                      required={m.isCaptain}
                    />
                  </div>

                  {/* SteamID64 & Faceit lookup */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      SteamID64 (17 цифр) {m.isCaptain ? <span style={{ color: 'var(--accent-orange)' }}>*</span> : <span style={{ color: 'var(--text-muted)' }}>(необязательно)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={m.isCaptain ? "76561198000000000" : "76561198000000000 (можно добавить позже)"}
                        value={m.steamId}
                        onChange={(e) => handleSteamIdChange(idx, e.target.value)}
                        maxLength={17}
                        required={m.isCaptain}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => performLookup(idx, m.steamId)}
                        disabled={m.isLoading || m.steamId.length !== 17}
                        style={{ padding: '0.65rem 0.85rem', flexShrink: 0 }}
                      >
                        {m.isLoading ? <Loader2 size={16} className="spin-animate" /> : 'Faceit'}
                      </button>
                    </div>
                  </div>

                  {/* Faceit Info Badge / Notice */}
                  {m.lookup && (
                    <div className="member-preview-card" style={{ marginTop: '0.25rem' }}>
                      <div className="player-faceit-info">
                        <FaceitBadge level={m.lookup.faceit_level} elo={m.lookup.faceit_elo} />
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          Faceit: {m.lookup.faceit_nickname || 'Привязан'}
                        </span>
                      </div>
                      {m.lookup.not_found && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Faceit не найден (участие разрешено)
                        </span>
                      )}
                    </div>
                  )}

                  {m.error && !m.lookup && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {m.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  Регистрация команды...
                </>
              ) : (
                'Подтвердить заявку'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
