import React, { useState, useEffect } from 'react';
import type { Tournament, Team, Match } from '../types/database.types';
import { fetchTournamentById, advanceMatchWinner, cancelTeamRegistration } from '../lib/supabase';
import { BracketTree } from '../components/BracketTree';
import { AdminControls } from '../components/AdminControls';
import { RegistrationModal } from '../components/RegistrationModal';
import { TeammateFinder } from '../components/TeammateFinder';
import { FaceitBadge } from '../components/FaceitBadge';
import { useAuth } from '../context/AuthContext';
import { formatTournamentDateTime, getEffectiveTournamentStatus } from '../lib/dateUtils';
import {
  ArrowLeft,
  Calendar,
  Users,
  Trophy,
  Shield,
  Layers,
  UserPlus,
  ExternalLink,
  Loader2,
  AlertCircle,
  RotateCw
} from 'lucide-react';

interface TournamentDetailViewProps {
  tournamentId: string;
  onBack: () => void;
}

export const TournamentDetailView: React.FC<TournamentDetailViewProps> = ({
  tournamentId,
  onBack,
}) => {
  const { user, isAdmin, loginWithDiscord } = useAuth();
  const [data, setData] = useState<{ tournament: Tournament; teams: Team[]; matches: Match[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bracket' | 'teams' | 'lfg'>('bracket');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTournamentById(tournamentId);
      setData(res);
    } catch (err) {
      console.error('Failed to load tournament detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [tournamentId]);

  const handleAdvanceWinner = async (
    matchId: string,
    winnerId: string,
    scoreA: number,
    scoreB: number
  ) => {
    await advanceMatchWinner(matchId, winnerId, scoreA, scoreB);
    await loadDetails();
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={36} className="spin-animate" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--md-primary)' }} />
        Загрузка информации о турнире...
      </div>
    );
  }

  if (!data || !data.tournament) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <AlertCircle size={48} color="var(--md-error)" style={{ marginBottom: '1rem' }} />
        <h2>Турнир не найден</h2>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Вернуться к списку
        </button>
      </div>
    );
  }

  const { tournament, teams, matches } = data;
  const effectiveStatus = getEffectiveTournamentStatus(tournament);
  const userTeam = user ? teams.find((t) => t.captain_id === user.id) : null;
  const isRegistered = Boolean(userTeam);
  const isFull = teams.length >= tournament.bracket_size;
  const isRegOpen = effectiveStatus === 'registration_open';

  const regStartInfo = formatTournamentDateTime(tournament.registration_start);
  const tournStartInfo = formatTournamentDateTime(tournament.tournament_start);

  const handleCancelRegistration = async () => {
    if (!userTeam) return;
    if (!confirm('Вы уверены, что хотите отменить заявку и освободить слот?')) return;
    try {
      await cancelTeamRegistration(userTeam.id);
      await loadDetails();
    } catch (err) {
      alert('Ошибка при отмене заявки: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <button onClick={onBack} className="back-link">
          <ArrowLeft size={16} />
          Назад ко всем турнирам
        </button>
      </div>

      <div className="tournament-detail-header">
        <div className="detail-header-content">
          <div className="detail-title-group">
            <div className="card-badges">
              <span className="badge badge-format">CS2 {tournament.format}</span>
              <span className={`badge badge-${effectiveStatus}`}>
                {effectiveStatus === 'registration_open' ? 'Регистрация открыта' :
                 effectiveStatus === 'in_progress' ? 'Идет турнир' :
                 effectiveStatus === 'completed' ? 'Завершен' :
                 effectiveStatus === 'registration_closed' ? 'Регистрация закрыта' : 'Скоро'}
              </span>
              <span className="badge badge-upcoming">
                {teams.length} / {tournament.bracket_size} слотов
              </span>
            </div>

            <h1 className="detail-title">{tournament.title}</h1>

            {tournament.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '800px', lineHeight: 1.5 }}>
                {tournament.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={loadDetails}
              className="btn btn-secondary btn-sm"
              title="Обновить данные турнира и заявки"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCw size={14} className={isLoading ? 'spin-animate' : ''} />
              Обновить
            </button>

            {isRegOpen && !isFull && (
              isRegistered ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div className="badge badge-registration_open" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
                    Вы зарегистрированы
                  </div>
                  <button
                    onClick={handleCancelRegistration}
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                  >
                    Отменить заявку
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!user) loginWithDiscord();
                    else setShowRegisterModal(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Trophy size={15} />
                  Подать заявку на турнир
                </button>
              )
            )}
          </div>
        </div>

        {/* Adaptive Timezone Meta Bar */}
        <div className="card-meta-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="meta-item">
            <span className="meta-label">Старт регистрации</span>
            <span className="meta-value">
              <Calendar size={13} color="var(--md-primary)" />
              {regStartInfo.formatted}
            </span>
            <span className="tz-hint">{regStartInfo.fullWithTz.split('(')[1]?.replace(')', '') || 'местное время'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Старт турнира</span>
            <span className="meta-value">
              <Calendar size={13} color="var(--md-secondary)" />
              {tournStartInfo.formatted}
            </span>
            <span className="tz-hint">{tournStartInfo.fullWithTz.split('(')[1]?.replace(')', '') || 'местное время'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Формат сетки</span>
            <span className="meta-value">
              Single Elimination ({tournament.bracket_size} слотов)
            </span>
            <span className="tz-hint">Олимпийская сетка на выбывание</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Организатор</span>
            <span className="meta-value">
              <Shield size={13} color="var(--md-primary)" />
              {tournament.creator?.discord_username || 'Администратор'}
            </span>
            <span className="tz-hint">BAZA CS2 Community</span>
          </div>
        </div>

        {/* Prize Pool Showcase */}
        {(tournament.prize_first || tournament.prize_second || tournament.prize_third) && (
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
              🏆 Награды и призовой фонд
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {tournament.prize_first && (
                <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥇</span>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#ffd700', fontWeight: 700, textTransform: 'uppercase' }}>1-е место</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tournament.prize_first}</div>
                  </div>
                </div>
              )}
              {tournament.prize_second && (
                <div style={{ background: 'rgba(192, 192, 192, 0.08)', border: '1px solid rgba(192, 192, 192, 0.3)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥈</span>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#c0c0c0', fontWeight: 700, textTransform: 'uppercase' }}>2-е место</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tournament.prize_second}</div>
                  </div>
                </div>
              )}
              {tournament.prize_third && (
                <div style={{ background: 'rgba(205, 127, 50, 0.08)', border: '1px solid rgba(205, 127, 50, 0.3)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥉</span>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#cd7f32', fontWeight: 700, textTransform: 'uppercase' }}>3-е место</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tournament.prize_third}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <AdminControls
          tournament={tournament}
          teams={teams}
          onRefresh={loadDetails}
          onDeleted={onBack}
        />
      )}

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.65rem', borderBottom: '1px solid var(--md-outline-variant)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeTab === 'bracket' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('bracket')}
        >
          <Layers size={15} />
          Турнирная сетка ({matches.length})
        </button>
        <button
          className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={15} />
          Участники и команды ({teams.length})
        </button>
        <button
          className={`btn ${activeTab === 'lfg' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('lfg')}
        >
          <UserPlus size={15} />
          Поиск тиммейтов
        </button>
      </div>

      {/* Tab Content: Bracket Tree */}
      {activeTab === 'bracket' && (
        <BracketTree
          tournament={tournament}
          matches={matches}
          isAdmin={isAdmin}
          onAdvanceWinner={handleAdvanceWinner}
        />
      )}

      {/* Tab Content: Teams & Members */}
      {activeTab === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Зарегистрировано команд: <strong>{teams.length}</strong> из <strong>{tournament.bracket_size}</strong>
            </span>
            <button
              onClick={loadDetails}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCw size={13} className={isLoading ? 'spin-animate' : ''} />
              Обновить список
            </button>
          </div>

          {teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--md-surface)', borderRadius: '12px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Пока никто не зарегистрировался на этот турнир.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {teams.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--md-surface)',
                    border: '1px solid var(--md-outline-variant)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--md-primary)', fontSize: '1rem' }}>
                        #{t.bracket_position || idx + 1}
                      </span>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                        {t.name}
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Капитан: {t.captain?.discord_username || 'Игрок'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--md-outline-variant)', paddingTop: '0.6rem' }}>
                    {t.members?.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem',
                          padding: '0.35rem 0.5rem',
                          background: 'var(--md-surface-container)',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FaceitBadge level={m.faceit_level} elo={m.faceit_elo} />
                          <span style={{ fontWeight: 600 }}>{m.faceit_nickname || 'Steam Игрок'}</span>
                        </div>
                        <a
                          href={`https://steamcommunity.com/profiles/${m.steam_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          SteamID <ExternalLink size={10} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: LFG Teammate Finder */}
      {activeTab === 'lfg' && (
        <TeammateFinder
          tournament={tournament}
          currentUser={user}
          userTeam={userTeam}
          onLoginRequest={loginWithDiscord}
          onTeamUpdated={loadDetails}
        />
      )}

      {showRegisterModal && user && (
        <RegistrationModal
          tournament={tournament}
          currentUser={user}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            loadDetails();
          }}
        />
      )}
    </div>
  );
};
