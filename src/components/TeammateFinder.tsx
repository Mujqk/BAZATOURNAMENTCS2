import React, { useState, useEffect } from 'react';
import type { Tournament, LfgRequest, Profile } from '../types/database.types';
import { fetchLfgRequests, createLfgRequest, deleteLfgRequest } from '../lib/supabase';
import { FaceitBadge } from './FaceitBadge';
import { Users, Plus, Trash2, Copy, Check, Crosshair, AlertCircle, Loader2 } from 'lucide-react';

interface TeammateFinderProps {
  tournament: Tournament;
  currentUser: Profile | null;
  onLoginRequest: () => void;
}

export const TeammateFinder: React.FC<TeammateFinderProps> = ({
  tournament,
  currentUser,
  onLoginRequest,
}) => {
  const [requests, setRequests] = useState<LfgRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [nickname, setNickname] = useState(currentUser?.discord_username || '');
  const [discordTag, setDiscordTag] = useState(currentUser?.discord_username || '');
  const [role, setRole] = useState('Любая');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await fetchLfgRequests(tournament.id);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load LFG requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [tournament.id]);

  const userRequest = currentUser
    ? requests.find((r) => r.user_id === currentUser.id)
    : null;

  const handleCopyDiscord = (tag: string, id: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onLoginRequest();
      return;
    }

    if (!nickname.trim() || !discordTag.trim()) {
      setError('Пожалуйста, укажите ваш никнейм и контакт в Discord.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createLfgRequest({
        tournament_id: tournament.id,
        user_id: currentUser.id,
        nickname: nickname.trim(),
        discord_tag: discordTag.trim(),
        role,
        description: description.trim() || null,
      });

      setShowModal(false);
      setDescription('');
      await loadRequests();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Удалить вашу анкету из поиска тиммейтов?')) return;
    try {
      await deleteLfgRequest(requestId);
      await loadRequests();
    } catch (err) {
      alert('Ошибка при удалении анкеты: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--glass-border)',
          borderRadius: '14px',
          padding: '1.25rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={20} color="var(--md-primary)" />
            Поиск тиммейтов и команд ({requests.length})
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {tournament.format === '1x1'
              ? 'Игроки, готовые к дуэлям и спаррингам'
              : 'Игроки без команды или капитаны, которым не хватает игроков в состав'}
          </p>
        </div>

        {userRequest ? (
          <button
            onClick={() => handleDelete(userRequest.id)}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
          >
            <Trash2 size={14} />
            Удалить мою анкету
          </button>
        ) : (
          <button
            onClick={() => {
              if (!currentUser) onLoginRequest();
              else {
                setNickname(currentUser.discord_username);
                setDiscordTag(currentUser.discord_username);
                setShowModal(true);
              }
            }}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} />
            Оставить анкету (Ищу команду)
          </button>
        )}
      </div>

      {/* Requests Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={30} className="spin-animate" style={{ margin: '0 auto 0.75rem', display: 'block', color: 'var(--md-primary)' }} />
          Загрузка анкет игроков...
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
          }}
        >
          <Crosshair size={42} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
            Пока никто не ищет команду на этот турнир
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem', maxWidth: '480px', margin: '0.4rem auto 1.25rem' }}>
            Вы можете первым оставить анкету, чтобы капитаны команд или другие свободные игроки могли связаться с вами в Discord.
          </p>
          <button
            onClick={() => {
              if (!currentUser) onLoginRequest();
              else {
                setNickname(currentUser.discord_username);
                setDiscordTag(currentUser.discord_username);
                setShowModal(true);
              }
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Подать объявление о поиске
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
          {requests.map((r) => {
            const isMe = currentUser?.id === r.user_id;
            const isCopied = copiedId === r.id;

            return (
              <div
                key={r.id}
                style={{
                  background: isMe ? 'rgba(208, 188, 255, 0.08)' : 'var(--glass-bg)',
                  border: `1px solid ${isMe ? 'var(--md-primary)' : 'var(--glass-border)'}`,
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {r.user?.avatar_url ? (
                      <img
                        src={r.user.avatar_url}
                        alt=""
                        style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'var(--md-primary-container)',
                          color: 'var(--md-on-primary-container)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {r.nickname.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                        {r.nickname} {isMe && <span style={{ fontSize: '0.72rem', color: 'var(--md-primary)', fontWeight: 600 }}>(Вы)</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                        <span className="badge badge-format" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          {r.role}
                        </span>
                        {r.faceit_elo ? (
                          <FaceitBadge level={r.faceit_level} elo={r.faceit_elo} />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isMe && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="btn btn-secondary btn-sm"
                      title="Удалить мою анкету"
                      style={{ padding: '0.35rem 0.5rem', color: '#f87171' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {r.description && (
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45, background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '8px', margin: 0 }}>
                    «{r.description}»
                  </p>
                )}

                {/* Discord copy button */}
                <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                  <button
                    onClick={() => handleCopyDiscord(r.discord_tag, r.id)}
                    className={`btn ${isCopied ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} />
                        Discord скопирован!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Discord: {r.discord_tag}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create LFG Request */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--md-primary)" />
                Анкета поиска тиммейтов
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {error && (
                  <div className="alert-box alert-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ваш игровой никнейм</label>
                  <input
                    type="text"
                    className="form-input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    placeholder="Например: s1mple, donk"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Discord для связи (тег или юзернейм)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={discordTag}
                    onChange={(e) => setDiscordTag(e.target.value)}
                    required
                    placeholder="Например: my_discord_tag"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Предпочитаемая роль</label>
                  <select
                    className="form-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="Любая">Любая роль</option>
                    <option value="Снайпер (AWP)">Снайпер (AWP)</option>
                    <option value="Рифлер / Энтри">Рифлер / Энтри-фраггер</option>
                    <option value="Капитан (IGL)">Капитан (IGL / Координатор)</option>
                    <option value="Саппорт / Опорник">Саппорт / Опорник</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">О себе / Пожелания (необязательно)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Опыт, в какое время можете играть, прайм-тайм..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
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
                      Публикация...
                    </>
                  ) : (
                    'Опубликовать анкету'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
