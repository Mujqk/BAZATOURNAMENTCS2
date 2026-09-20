import React, { useState, useEffect } from 'react';
import type { Tournament, TournamentBlacklistEntry, Profile } from '../types/database.types';
import { fetchBlacklist, addToBlacklist, removeFromBlacklist } from '../lib/supabase';
import {
  Ban,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Loader2,
  Globe,
  Trophy,
  RotateCw,
  Search
} from 'lucide-react';

interface AdminBlacklistModalProps {
  tournament?: Tournament;
  currentUser: Profile;
  onClose: () => void;
  onUpdated?: () => void;
  initialSteamId?: string;
  initialDiscordTag?: string;
}

export const AdminBlacklistModal: React.FC<AdminBlacklistModalProps> = ({
  tournament,
  currentUser,
  onClose,
  onUpdated,
  initialSteamId = '',
  initialDiscordTag = '',
}) => {
  const [bans, setBans] = useState<TournamentBlacklistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [activeTab, setActiveTab] = useState<'list' | 'add'>(initialSteamId || initialDiscordTag ? 'add' : 'list');
  const [steamId, setSteamId] = useState(initialSteamId);
  const [discordTag, setDiscordTag] = useState(initialDiscordTag);
  const [reason, setReason] = useState('');
  const [banScope, setBanScope] = useState<'tournament' | 'global'>(tournament ? 'tournament' : 'global');
  const [searchQuery, setSearchQuery] = useState('');

  const loadBans = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBlacklist(tournament?.id);
      setBans(data);
    } catch (err) {
      console.error('Failed to load blacklist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBans();
  }, [tournament?.id]);

  const handleAddBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steamId.trim() && !discordTag.trim()) {
      setError('Укажите хотя бы SteamID64 или Discord тег нарушителя.');
      return;
    }

    if (steamId.trim() && !/^\d{17}$/.test(steamId.trim())) {
      setError('SteamID64 должен состоять из 17 цифр.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await addToBlacklist({
        steamId: steamId.trim() || null,
        discordUsername: discordTag.trim() || null,
        reason: reason.trim() || 'Нарушение регламента турниров',
        tournamentId: banScope === 'tournament' && tournament ? tournament.id : null,
        bannedBy: currentUser.id,
      });

      setSuccess('Игрок успешно внесен в черный список!');
      setSteamId('');
      setDiscordTag('');
      setReason('');
      await loadBans();
      if (onUpdated) onUpdated();
      setTimeout(() => {
        setSuccess(null);
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveBan = async (banId: string, name: string) => {
    if (!confirm(`Снять блокировку с игрока «${name}»?`)) return;
    try {
      await removeFromBlacklist(banId);
      await loadBans();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Ошибка при снятии бана: ' + (err as Error).message);
    }
  };

  const filteredBans = bans.filter((b) => {
    const q = searchQuery.toLowerCase();
    const s = (b.steam_id || '').toLowerCase();
    const d = (b.discord_username || '').toLowerCase();
    const r = (b.reason || '').toLowerCase();
    return s.includes(q) || d.includes(q) || r.includes(q);
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171' }}>
            <Ban size={20} />
            Черный список участников (Blacklist)
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.6rem' }}>
            <button
              type="button"
              className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('list')}
            >
              Заблокированные ({bans.length})
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('add')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} />
              Добавить в черный список
            </button>
          </div>

          {error && (
            <div className="alert-box alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-box alert-info" style={{ borderColor: 'var(--md-success)' }}>
              <Check size={16} color="var(--md-success)" />
              <span style={{ color: 'var(--md-success)', fontWeight: 600 }}>{success}</span>
            </div>
          )}

          {activeTab === 'add' ? (
            <form onSubmit={handleAddBan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Тип ограничения / Область действия</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {tournament && (
                    <button
                      type="button"
                      onClick={() => setBanScope('tournament')}
                      className={`btn ${banScope === 'tournament' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ justifyContent: 'center', padding: '0.65rem' }}
                    >
                      <Trophy size={14} />
                      Только этот турнир
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBanScope('global')}
                    className={`btn ${banScope === 'global' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ justifyContent: 'center', padding: '0.65rem' }}
                  >
                    <Globe size={14} />
                    Глобально (все турниры)
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {banScope === 'global'
                    ? 'Пользователь не сможет регистрироваться и участвовать ни в одном турнире сообщества.'
                    : `Пользователь будет заблокирован только на текущем турнире «${tournament?.title}».`}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">SteamID64 нарушителя (17 цифр)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="76561198000000000"
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value.replace(/\D/g, ''))}
                  maxLength={17}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Discord тег / Никнейм нарушителя</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Например: toxic_player#0000 или nick"
                  value={discordTag}
                  onChange={(e) => setDiscordTag(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Причина блокировки</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Причина (читерство, неявка, токсичность, передача аккаунта...)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || (!steamId && !discordTag)}
                  style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin-animate" />
                      Внесение в ЧС...
                    </>
                  ) : (
                    <>
                      <Ban size={16} />
                      Заблокировать игрока
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Search & Refresh */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Поиск по SteamID, Discord или причине..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2rem' }}
                  />
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <button
                  onClick={loadBans}
                  className="btn btn-secondary btn-sm"
                  title="Обновить список"
                >
                  <RotateCw size={14} className={isLoading ? 'spin-animate' : ''} />
                </button>
              </div>

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <Loader2 size={24} className="spin-animate" style={{ margin: '0 auto 0.5rem', display: 'block', color: 'var(--md-primary)' }} />
                  Загрузка черного списка...
                </div>
              ) : filteredBans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                  <Ban size={32} style={{ margin: '0 auto 0.5rem', color: 'var(--text-muted)' }} />
                  <p>В черном списке нет записей.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '380px', overflowY: 'auto' }}>
                  {filteredBans.map((ban) => {
                    const isGlobal = !ban.tournament_id;
                    const displayName = ban.discord_username || ban.steam_id || 'Игрок';

                    return (
                      <div
                        key={ban.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isGlobal ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                          borderRadius: '10px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              {ban.discord_username || 'Steam ID'}
                            </span>
                            <span
                              className={`badge ${isGlobal ? 'badge-cancelled' : 'badge-format'}`}
                              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
                            >
                              {isGlobal ? 'Глобальный бан' : 'Бан турнира'}
                            </span>
                          </div>

                          {ban.steam_id && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              SteamID64: <strong style={{ color: 'var(--md-primary)' }}>{ban.steam_id}</strong>
                            </div>
                          )}

                          {ban.reason && (
                            <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '0.1rem' }}>
                              Причина: «{ban.reason}»
                            </div>
                          )}

                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Заблокирован: {new Date(ban.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveBan(ban.id, displayName)}
                          className="btn btn-secondary btn-sm"
                          title="Снять блокировку"
                          style={{ padding: '0.35rem 0.6rem', color: '#f87171', flexShrink: 0 }}
                        >
                          <Trash2 size={14} />
                          Разбан
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
