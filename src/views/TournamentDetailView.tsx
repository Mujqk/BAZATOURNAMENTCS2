import React, { useState, useEffect } from 'react';
import type { Tournament, Team, Match, TeamJoinRequest } from '../types/database.types';
import {
  fetchTournamentById,
  advanceMatchWinner,
  cancelTeamRegistration,
  fetchTeamJoinRequests,
  respondToTeamJoinRequest,
  removeTeamMember,
  adminDeleteTeam,
} from '../lib/supabase';
import { BracketTree } from '../components/BracketTree';
import { AdminControls } from '../components/AdminControls';
import { RegistrationModal } from '../components/RegistrationModal';
import { TeammateFinder } from '../components/TeammateFinder';
import { FaceitBadge } from '../components/FaceitBadge';
import { TeamApplicationModal } from '../components/TeamApplicationModal';
import { CaptainApplicationsModal } from '../components/CaptainApplicationsModal';
import { AdminBlacklistModal } from '../components/AdminBlacklistModal';
import { useAuth } from '../context/AuthContext';
import { formatTournamentDateTime, getEffectiveTournamentStatus } from '../lib/dateUtils';
import {
  ArrowLeft,
  Calendar,
  Users,
  Shield,
  Layers,
  UserPlus,
  ExternalLink,
  Loader2,
  AlertCircle,
  RotateCw,
  Mail,
  Check,
  X,
  FileText,
  Trash2,
  Ban,
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
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bracket' | 'teams' | 'lfg'>('bracket');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedTeamToApply, setSelectedTeamToApply] = useState<Team | null>(null);
  const [showCaptainAppsModal, setShowCaptainAppsModal] = useState(false);
  const [isRespondingInvite, setIsRespondingInvite] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistTarget, setBlacklistTarget] = useState<{
    steamId?: string;
    discordTag?: string;
  } | null>(null);

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTournamentById(tournamentId);
      setData(res);
      const reqs = await fetchTeamJoinRequests({ tournamentId });
      setJoinRequests(reqs);
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

  const captainTeam = user ? teams.find((t) => t.captain_id === user.id) : null;
  const isUserMember = user ? teams.some((t) => t.members?.some((m) => m.faceit_nickname === user.discord_username)) : false;
  const isRegistered = Boolean(captainTeam || isUserMember);
  const userTeam = captainTeam || teams.find((t) => t.members?.some((m) => m.faceit_nickname === user?.discord_username)) || null;

  const isFull = teams.length >= tournament.bracket_size;
  const isRegOpen = effectiveStatus === 'registration_open';
  const maxMembersPerTeam = tournament.format === '1x1' ? 1 : tournament.format === '2x2' ? 2 : 5;

  const regStartInfo = formatTournamentDateTime(tournament.registration_start);
  const tournStartInfo = formatTournamentDateTime(tournament.tournament_start);

  // Incoming invites for current player
  const myPendingInvites = user
    ? joinRequests.filter((r) => r.type === 'invite' && r.status === 'pending' && r.user_id === user.id)
    : [];

  // Incoming applications for captain's team
  const captainPendingApps = captainTeam
    ? joinRequests.filter((r) => r.type === 'application' && r.status === 'pending' && r.team_id === captainTeam.id)
    : [];

  const handleCancelRegistration = async () => {
    if (!captainTeam) return;
    if (!confirm('Вы уверены, что хотите отменить регистрацию команды и освободить слот?')) return;
    try {
      await cancelTeamRegistration(captainTeam.id);
      await loadDetails();
    } catch (err) {
      alert('Ошибка при отмене заявки: ' + (err as Error).message);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setIsRespondingInvite(true);
    try {
      await respondToTeamJoinRequest(inviteId, 'accept', tournament.format);
      await loadDetails();
    } catch (err: any) {
      alert(err.message || 'Не удалось принять приглашение');
      await loadDetails();
    } finally {
      setIsRespondingInvite(false);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    setIsRespondingInvite(true);
    try {
      await respondToTeamJoinRequest(inviteId, 'reject', tournament.format);
      await loadDetails();
    } catch (err: any) {
      alert('Ошибка при отклонении: ' + err.message);
    } finally {
      setIsRespondingInvite(false);
    }
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Исключить игрока ${memberName} из состава команды?`)) return;
    try {
      await removeTeamMember(memberId);
      await loadDetails();
    } catch (err: any) {
      alert('Ошибка при исключении игрока: ' + err.message);
    }
  };

  const isModerator = Boolean(isAdmin || (user && tournament.created_by === user.id));

  const handleAdminDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Вы точно хотите удалить команду «${teamName}» с турнира? Слот освободится.`)) return;
    try {
      await adminDeleteTeam(teamId);
      await loadDetails();
    } catch (err: any) {
      alert('Ошибка при удалении команды: ' + (err.message || 'Не удалось удалить команду'));
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
              {tournament.allow_lvl10 === false && (
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  🚫 Без 10 lvl
                </span>
              )}
              {tournament.allow_lvl10 !== false && tournament.max_lvl10_per_team && (
                <span className="badge" style={{ background: 'rgba(234, 88, 12, 0.15)', color: '#fb923c', border: '1px solid rgba(234, 88, 12, 0.3)' }}>
                  ⭐ Макс. {tournament.max_lvl10_per_team}x 10 lvl
                </span>
              )}
              {tournament.max_faceit_elo && (
                <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  ⚡ До {tournament.max_faceit_elo} ELO
                </span>
              )}
              {(tournament.min_faceit_level || tournament.max_faceit_level) && (
                <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  🎯 {tournament.min_faceit_level || 1}–{tournament.max_faceit_level || 10} lvl
                </span>
              )}
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
                  <UserPlus size={15} />
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

      {/* Incoming Invitations Banner for current player */}
      {myPendingInvites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {myPendingInvites.map((inv) => (
            <div
              key={inv.id}
              style={{
                background: 'rgba(208, 188, 255, 0.08)',
                border: '1px solid var(--md-primary)',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--md-primary-container)',
                    color: 'var(--md-on-primary-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Mail size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                    Входящее приглашение в команду!
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Капитан команды <strong style={{ color: 'var(--md-primary)' }}>«{inv.team?.name || 'Команда'}»</strong> приглашает вас вступить в свой состав на этот турнир.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAcceptInvite(inv.id)}
                  disabled={isRespondingInvite}
                >
                  {isRespondingInvite ? <Loader2 size={14} className="spin-animate" /> : <Check size={14} />}
                  Принять приглашение
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRejectInvite(inv.id)}
                  disabled={isRespondingInvite}
                  style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <X size={14} />
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incoming Applications Banner for Team Captain */}
      {captainPendingApps.length > 0 && (
        <div
          style={{
            background: 'rgba(250, 204, 21, 0.08)',
            border: '1px solid rgba(250, 204, 21, 0.4)',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(250, 204, 21, 0.2)',
                color: '#facc15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                Новые заявки в вашу команду ({captainPendingApps.length})!
              </div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Игроки хотят вступить в состав команды <strong style={{ color: '#facc15' }}>«{captainTeam?.name}»</strong>. Проверьте их профили Faceit и примите или отклоните.
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCaptainAppsModal(true)}
            style={{ background: '#facc15', color: '#000', fontWeight: 700, border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileText size={15} />
            Открыть заявки ({captainPendingApps.length})
          </button>
        </div>
      )}

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
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <Users size={15} />
          Участники и команды ({teams.length})
          {captainPendingApps.length > 0 && (
            <span
              style={{
                background: '#facc15',
                color: '#000',
                borderRadius: '10px',
                padding: '0.1rem 0.45rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                marginLeft: '0.4rem',
              }}
            >
              +{captainPendingApps.length}
            </span>
          )}
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
              {teams.map((t, idx) => {
                const isMyCaptainTeam = captainTeam?.id === t.id;
                const membersCount = t.members ? t.members.length : 1;
                const isTeamSlotsFull = membersCount >= maxMembersPerTeam;

                return (
                  <div
                    key={t.id}
                    style={{
                      background: isMyCaptainTeam ? 'rgba(208, 188, 255, 0.05)' : 'var(--md-surface)',
                      border: `1px solid ${isMyCaptainTeam ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--md-primary)', fontSize: '1rem' }}>
                          #{t.bracket_position || idx + 1}
                        </span>
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                          {t.name}
                        </h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Капитан: {t.captain?.discord_username || 'Игрок'}
                        </span>
                        {isModerator && (
                          <button
                            onClick={() => handleAdminDeleteTeam(t.id, t.name || 'Без названия')}
                            className="btn btn-secondary btn-sm"
                            title="Снять команду с турнира (Организатор / Админ)"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Trash2 size={12} />
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Captain's Incoming Applications Button */}
                    {isMyCaptainTeam && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Состав: {membersCount} / {maxMembersPerTeam}
                        </span>
                        <button
                          onClick={() => setShowCaptainAppsModal(true)}
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.6rem',
                            background: captainPendingApps.length > 0 ? 'var(--md-primary)' : 'var(--md-surface-container)',
                            color: captainPendingApps.length > 0 ? '#000' : 'var(--text-primary)',
                          }}
                        >
                          <FileText size={13} />
                          Заявки в команду ({captainPendingApps.length})
                        </button>
                      </div>
                    )}

                    {/* Members List */}
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <a
                              href={`https://steamcommunity.com/profiles/${m.steam_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              SteamID <ExternalLink size={10} />
                            </a>

                            {/* Moderator ban shortcut */}
                            {isModerator && (
                              <button
                                onClick={() => {
                                  setBlacklistTarget({
                                    steamId: m.steam_id || undefined,
                                    discordTag: m.faceit_nickname || undefined,
                                  });
                                  setShowBlacklistModal(true);
                                }}
                                className="btn btn-secondary btn-sm"
                                title="Внести игрока в черный список (бан)"
                                style={{ padding: '0.2rem 0.35rem', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              >
                                <Ban size={12} />
                              </button>
                            )}

                            {/* Kick member button for captain */}
                            {isMyCaptainTeam && !m.is_captain && (
                              <button
                                onClick={() => handleKickMember(m.id, m.faceit_nickname || 'игрока')}
                                className="btn btn-secondary btn-sm"
                                title="Исключить из команды"
                                style={{ padding: '0.2rem 0.35rem', color: '#f87171' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Application Button for Free Players */}
                    {!isRegistered && !isTeamSlotsFull && (
                      <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                        <button
                          onClick={() => {
                            if (!user) loginWithDiscord();
                            else setSelectedTeamToApply(t);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <UserPlus size={14} />
                          Подать заявку в состав ({maxMembersPerTeam - membersCount} мест свободно)
                        </button>
                      </div>
                    )}

                    {isTeamSlotsFull && !isMyCaptainTeam && (
                      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                        Состав полностью укомплектован
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Modal: Team Registration */}
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

      {/* Modal: Player Applying to Team */}
      {selectedTeamToApply && user && (
        <TeamApplicationModal
          tournament={tournament}
          team={selectedTeamToApply}
          currentUser={user}
          onClose={() => setSelectedTeamToApply(null)}
          onSuccess={loadDetails}
        />
      )}

      {/* Modal: Captain Reviewing Candidate Dossiers */}
      {showCaptainAppsModal && captainTeam && (
        <CaptainApplicationsModal
          tournament={tournament}
          team={captainTeam}
          applications={joinRequests.filter((r) => r.team_id === captainTeam.id && r.type === 'application')}
          onClose={() => setShowCaptainAppsModal(false)}
          onUpdated={loadDetails}
        />
      )}

      {/* Modal: Admin Blacklist */}
      {showBlacklistModal && user && isModerator && (
        <AdminBlacklistModal
          tournament={tournament}
          currentUser={user}
          initialSteamId={blacklistTarget?.steamId || ''}
          initialDiscordTag={blacklistTarget?.discordTag || ''}
          onClose={() => {
            setShowBlacklistModal(false);
            setBlacklistTarget(null);
          }}
          onUpdated={loadDetails}
        />
      )}
    </div>
  );
};

